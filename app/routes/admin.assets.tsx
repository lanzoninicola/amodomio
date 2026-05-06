import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Copy,
  FileImage,
  FileVideo,
  Folder,
  FolderPlus,
  FolderTree,
  Home,
  Link2,
  Pencil,
  Search,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { authenticator } from "~/domain/auth/google.server";
import { toast } from "~/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import {
  FOLDER_SEGMENT_REGEX,
  getFolderLabel,
  getFolderLineage,
  getParentPath,
  isSafePath,
  normalizeFolderSegment,
  normalizePath,
  replacePathPrefix,
  type LibraryPayload,
  type MediaAsset,
  type MediaFolder,
  type UploadKind,
} from "~/domain/media/media.shared";

type LoaderData = {
  mediaApiBaseUrl: string;
  mediaBaseUrl: string;
  hasUploadApiKey: boolean;
  mediaApiHealth: {
    ok: boolean;
    endpoint: "/healthcheck" | "/health" | null;
    status: number | null;
  };
  library: LibraryPayload;
};

type ActionData =
  | {
      ok: true;
      message: string;
      payload: LibraryPayload;
    }
  | {
      ok: false;
      message: string;
      debug?: string;
    };

type UploadProgressItem = {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  message?: string;
};

type UploadResult = {
  ok: boolean;
  message: string;
  payload?: LibraryPayload;
};

export const meta: MetaFunction = () => [{ title: "Admin • Asset Drive" }];

function formatMegabytes(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request);
  const mediaService = await import("~/domain/media/media.service.server");

  const library = await mediaService.readLibraryFromDb();

  return json<LoaderData>({
    mediaApiBaseUrl: mediaService.getMediaApiBaseUrl(),
    mediaBaseUrl: mediaService.getMediaBaseUrl(),
    hasUploadApiKey: Boolean(process.env.MEDIA_UPLOAD_API_KEY),
    mediaApiHealth: await mediaService.checkMediaApiHealth(),
    library,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);
  const mediaService = await import("~/domain/media/media.service.server");

  if (request.method !== "POST") {
    return json<ActionData>({ ok: false, message: "Método não permitido." }, { status: 405 });
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      if (!process.env.MEDIA_UPLOAD_API_KEY) {
        return json<ActionData>(
          { ok: false, message: "Configure MEDIA_UPLOAD_API_KEY no servidor para habilitar upload." },
          { status: 500 }
        );
      }

      const formData = await request.formData();
      const intent = String(formData.get("_intent") || "upload");

      if (intent !== "upload") {
        return json<ActionData>({ ok: false, message: "Ação inválida." }, { status: 400 });
      }

      const files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const kindRaw = String(formData.get("kind") || "image");
      const assetPathRaw = String(formData.get("assetPath") || "");
      const kind: UploadKind = kindRaw === "video" ? "video" : "image";
      const assetPath = normalizePath(assetPathRaw);

      if (files.length === 0) {
        return json<ActionData>({ ok: false, message: "Selecione ao menos um arquivo para upload." }, { status: 400 });
      }

      if (!isSafePath(assetPath)) {
        return json<ActionData>(
          { ok: false, message: "Selecione uma pasta válida antes de enviar o arquivo." },
          { status: 400 }
        );
      }

      const { successCount, failedFiles, payload } = await mediaService.uploadFilesToExternalService({
        files,
        kind,
        assetPath,
      });

      if (successCount === 0) {
        return json<ActionData>(
          {
            ok: false,
            message: "Falha no upload em lote. Nenhum arquivo foi enviado.",
          },
          { status: 502 }
        );
      }

      const failureMessage = failedFiles.length ? ` Falharam: ${failedFiles.join(", ")}.` : "";

      return json<ActionData>({
        ok: true,
        message: `Upload em lote concluído. Sucesso: ${successCount}/${files.length}.${failureMessage}`,
        payload,
      });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          intent?: string;
          currentPath?: string;
          folderName?: string;
          oldPath?: string;
          newPath?: string;
          assetId?: string;
          destinationPath?: string;
        }
      | null;

    const intent = String(body?.intent || "");

    if (intent === "create-folder") {
      const currentPath = normalizePath(String(body?.currentPath || ""));
      const segment = normalizeFolderSegment(String(body?.folderName || ""));

      if (!segment || !FOLDER_SEGMENT_REGEX.test(segment)) {
        return json<ActionData>(
          { ok: false, message: "Nome inválido. Use apenas letras, números, '-' e '_'." },
          { status: 400 }
        );
      }

      const targetPath = normalizePath(currentPath ? `${currentPath}/${segment}` : segment);
      const payload = await mediaService.createFolderByPath(targetPath);

      return json<ActionData>({ ok: true, message: "Pasta criada.", payload });
    }

    if (intent === "rename-folder") {
      const oldPath = normalizePath(String(body?.oldPath || ""));
      const newPath = normalizePath(String(body?.newPath || ""));

      if (!oldPath || !newPath || !isSafePath(oldPath) || !isSafePath(newPath)) {
        return json<ActionData>({ ok: false, message: "Path inválido para renomear." }, { status: 400 });
      }

      const payload = await mediaService.renameFolderPath(oldPath, newPath);
      if (!payload) {
        return json<ActionData>({ ok: false, message: "Pasta não encontrada." }, { status: 404 });
      }

      return json<ActionData>({ ok: true, message: "Pasta renomeada.", payload });
    }

    if (intent === "delete-folder") {
      const path = normalizePath(String(body?.currentPath || ""));
      if (!path || !isSafePath(path)) {
        return json<ActionData>({ ok: false, message: "Path inválido para exclusão." }, { status: 400 });
      }

      const payload = await mediaService.deleteFolderPath(path);
      return json<ActionData>({ ok: true, message: "Pasta removida.", payload });
    }

    if (intent === "delete-asset") {
      const assetId = String(body?.assetId || "").trim();
      if (!assetId) {
        return json<ActionData>({ ok: false, message: "Asset inválido." }, { status: 400 });
      }

      const payload = await mediaService.deleteAssetById(assetId);
      return json<ActionData>({ ok: true, message: "Asset removido.", payload });
    }

    if (intent === "move-asset") {
      const assetId = String(body?.assetId || "").trim();
      const destinationPath = normalizePath(String(body?.destinationPath || ""));

      if (!assetId || !destinationPath || !isSafePath(destinationPath)) {
        return json<ActionData>({ ok: false, message: "Dados inválidos para mover asset." }, { status: 400 });
      }

      const payload = await mediaService.moveAsset(assetId, destinationPath);
      return json<ActionData>({ ok: true, message: "Asset movido.", payload });
    }

    return json<ActionData>({ ok: false, message: "Ação inválida." }, { status: 400 });
  } catch (error) {
    const errorMessage = String((error as Error)?.message || "unknown_error");
    const rawMessage = errorMessage.toLowerCase();

    if (String((error as Error)?.message || "").includes("target_folder_conflict")) {
      return json<ActionData>(
        { ok: false, message: "Já existe uma pasta com esse nome no mesmo nível.", debug: errorMessage },
        { status: 409 }
      );
    }

    if (mediaService.isMissingRelationError(error)) {
      return json<ActionData>(
        {
          ok: false,
          message:
            "Estrutura de mídia não encontrada no banco. Rode a migration 20260723002000_create_media_library_tables.",
          debug: errorMessage,
        },
        { status: 500 }
      );
    }

    if (rawMessage.includes("gen_random_uuid")) {
      return json<ActionData>(
        {
          ok: false,
          message:
            "Banco sem extensão pgcrypto (gen_random_uuid). Habilite pgcrypto ou ajuste o default de UUID na migration.",
          debug: errorMessage,
        },
        { status: 500 }
      );
    }

    return json<ActionData>(
      { ok: false, message: "Não foi possível concluir a operação.", debug: errorMessage },
      { status: 500 }
    );
  }
}

export default function AdminAssetsPage() {
  const { mediaApiBaseUrl, mediaBaseUrl, hasUploadApiKey, mediaApiHealth, library } = useLoaderData<typeof loader>();

  const [folders, setFolders] = useState<MediaFolder[]>(library.folders || []);
  const [assets, setAssets] = useState<MediaAsset[]>(library.assets || []);
  const [currentFolder, setCurrentFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [search, setSearch] = useState("");
  const [uploadKind, setUploadKind] = useState<UploadKind>("image");
  const [kindFilter, setKindFilter] = useState<"all" | UploadKind>("all");
  const [lastErrorDebug, setLastErrorDebug] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);

  useEffect(() => {
    setFolders(library.folders || []);
    setAssets(library.assets || []);
  }, [library]);

  const allFolders = useMemo(() => folders.map((folder) => folder.path).sort((a, b) => a.localeCompare(b)), [folders]);

  const rootFolders = useMemo(() => {
    return allFolders.filter((folder) => !folder.includes("/"));
  }, [allFolders]);

  const childFolders = useMemo(() => {
    if (!currentFolder) return rootFolders;

    const prefix = `${currentFolder}/`;
    return allFolders
      .filter((folder) => folder.startsWith(prefix))
      .map((folder) => folder.slice(prefix.length))
      .filter((tail) => Boolean(tail) && !tail.includes("/"))
      .map((tail) => `${currentFolder}/${tail}`)
      .sort((a, b) => a.localeCompare(b));
  }, [allFolders, currentFolder, rootFolders]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return assets
      .filter((asset) => (currentFolder ? asset.assetPath === currentFolder : !asset.assetPath))
      .filter((asset) => (kindFilter === "all" ? true : asset.kind === kindFilter))
      .filter((asset) => {
        if (!normalizedSearch) return true;
        return asset.fileName.toLowerCase().includes(normalizedSearch) || asset.url.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt));
  }, [assets, currentFolder, kindFilter, search]);

  const visibleFolders = useMemo(() => {
    const currentLevelFolders = currentFolder ? childFolders : rootFolders;
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return currentLevelFolders;
    return currentLevelFolders.filter((folder) => folder.toLowerCase().includes(normalizedSearch));
  }, [childFolders, currentFolder, rootFolders, search]);

  const breadcrumbs = useMemo(() => {
    const normalized = normalizePath(currentFolder);
    if (!normalized) return [] as string[];
    return getFolderLineage(normalized);
  }, [currentFolder]);

  const sidebarFolders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return allFolders;
    return allFolders.filter((folder) => folder.toLowerCase().includes(normalizedSearch));
  }, [allFolders, search]);

  const storageUsage = useMemo(() => {
    const totalBytes = assets.reduce((sum, asset) => sum + (asset.sizeBytes || 0), 0);
    const unknownCount = assets.filter((asset) => asset.sizeBytes === null).length;
    return {
      totalBytes,
      totalMb: formatMegabytes(totalBytes),
      unknownCount,
    };
  }, [assets]);

  async function postIntent(input: Record<string, string>) {
    try {
      const response = await fetch("/admin/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const raw = await response.text();
      let data: ActionData | null = null;
      try {
        data = raw ? (JSON.parse(raw) as ActionData) : null;
      } catch {
        data = null;
      }

      // Some environments may return a non-JSON body even when the operation succeeded.
      if (!data && response.ok) {
        toast({
          title: "OK",
          description: "Operação concluída. Atualizando dados...",
        });
        window.location.reload();
        return null;
      }

      if (!data?.ok) {
        const fallback = raw?.slice(0, 180) || `status ${response.status}`;
        const serverDebug = data && !data.ok ? data.debug : undefined;
        const debugText = [
          `[media-debug] ${new Date().toISOString()}`,
          `intent=${input.intent || "unknown"}`,
          `http_status=${response.status}`,
          `message=${data?.message || "none"}`,
          `server_debug=${serverDebug || "none"}`,
          `raw=${raw || "none"}`,
        ].join("\n");
        setLastErrorDebug(debugText);
        toast({
          title: "Erro",
          description: data?.message || `Falha na operação (${fallback})`,
          variant: "destructive",
        });
        return null;
      }

      setFolders(data.payload.folders);
      setAssets(data.payload.assets);
      setLastErrorDebug("");
      toast({ title: "OK", description: data.message });
      return data;
    } catch (error) {
      const debugText = [
        `[media-debug] ${new Date().toISOString()}`,
        `intent=${input.intent || "unknown"}`,
        `network_error=${String((error as Error)?.message || "unknown")}`,
      ].join("\n");
      setLastErrorDebug(debugText);
      toast({
        title: "Erro",
        description: `Falha de rede ao executar operação. (${String((error as Error)?.message || "unknown")})`,
        variant: "destructive",
      });
      return null;
    }
  }

  async function uploadSingleFile(file: File, queueId: string) {
    return new Promise<UploadResult>((resolve) => {
      const formData = new FormData();
      formData.append("_intent", "upload");
      formData.append("kind", uploadKind);
      formData.append("assetPath", currentFolder);
      formData.append("files", file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/admin/assets");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setUploadQueue((current) =>
          current.map((item) => (item.id === queueId ? { ...item, progress: percent, status: "uploading" } : item))
        );
      };

      xhr.onload = () => {
        let data: ActionData | null = null;
        try {
          data = JSON.parse(xhr.responseText) as ActionData;
        } catch {
          data = null;
        }

        if (data) {
          if (data.ok) {
            resolve({ ok: true, message: data.message, payload: data.payload });
            return;
          }
          resolve({ ok: false, message: data.message });
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            ok: true,
            message: "Upload concluído. Atualizando biblioteca...",
          });
          return;
        }

        resolve({
          ok: false,
          message: `Resposta inválida do servidor no upload (status ${xhr.status || "?"}).`,
        });
      };

      xhr.onerror = () => {
        resolve({ ok: false, message: "Erro de rede durante upload." });
      };

      xhr.send(formData);
    });
  }

  async function uploadBatch() {
    if (!currentFolder) {
      toast({ title: "Erro", description: "Selecione uma pasta antes do upload.", variant: "destructive" });
      return;
    }
    if (!selectedFiles.length) {
      toast({ title: "Erro", description: "Selecione ao menos um arquivo.", variant: "destructive" });
      return;
    }

    const queue = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      fileName: file.name,
      progress: 0,
      status: "pending" as const,
    }));
    setUploadQueue(queue);
    setIsUploadingBatch(true);

    let successCount = 0;
    let failCount = 0;
    let shouldReloadLibrary = false;

    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      const file = selectedFiles[index];
      if (!file) continue;

      setUploadQueue((current) =>
        current.map((row) => (row.id === item.id ? { ...row, status: "uploading", progress: 1 } : row))
      );

      const result = await uploadSingleFile(file, item.id);

      if (result.ok) {
        successCount += 1;
        if (result.payload) {
          setFolders(result.payload.folders);
          setAssets(result.payload.assets);
        } else {
          shouldReloadLibrary = true;
        }
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, status: "success", progress: 100, message: result.message || "Concluído" } : row
          )
        );
      } else {
        failCount += 1;
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, status: "error", progress: 100, message: result.message } : row
          )
        );
      }
    }

    setIsUploadingBatch(false);
    setSelectedFiles([]);

    if (successCount > 0) {
      toast({
        title: "Upload concluído",
        description: `Sucesso: ${successCount}. Falhas: ${failCount}.`,
      });
      if (shouldReloadLibrary) {
        window.setTimeout(() => window.location.reload(), 400);
      }
    } else {
      toast({
        title: "Falha no upload",
        description: "Nenhum arquivo foi enviado com sucesso.",
        variant: "destructive",
      });
    }
  }

  async function createFolder() {
    const segment = normalizeFolderSegment(newFolderName);
    if (!segment || !FOLDER_SEGMENT_REGEX.test(segment)) {
      toast({
        title: "Nome inválido",
        description: "Use apenas letras, números, '-' e '_' no nome da pasta.",
        variant: "destructive",
      });
      return;
    }

    const result = await postIntent({ intent: "create-folder", currentPath: currentFolder, folderName: segment });
    if (!result) return;

    const createdPath = normalizePath(currentFolder ? `${currentFolder}/${segment}` : segment);
    setCurrentFolder(createdPath);
    setNewFolderName("");
  }

  async function renameFolderFromList(folderPath: string) {
    const currentName = getFolderLabel(folderPath);
    const typed = window.prompt(`Novo nome para a pasta "${currentName}":`, currentName);
    if (typed === null) return;

    const segment = normalizeFolderSegment(typed);
    if (!segment || !FOLDER_SEGMENT_REGEX.test(segment)) {
      toast({
        title: "Nome inválido",
        description: "Use apenas letras, números, '-' e '_'.",
        variant: "destructive",
      });
      return;
    }

    const parent = getParentPath(folderPath);
    const nextPath = normalizePath(parent ? `${parent}/${segment}` : segment);

    const result = await postIntent({ intent: "rename-folder", oldPath: folderPath, newPath: nextPath });
    if (!result) return;

    if (currentFolder === folderPath || currentFolder.startsWith(`${folderPath}/`)) {
      setCurrentFolder(replacePathPrefix(currentFolder, folderPath, nextPath));
    }
  }

  async function deleteFolderFromList(folderPath: string) {
    const confirmed = window.confirm(`Excluir pasta "${folderPath}" e todo o conteúdo?`);
    if (!confirmed) return;

    const parent = getParentPath(folderPath);
    const result = await postIntent({ intent: "delete-folder", currentPath: folderPath });
    if (!result) return;

    if (currentFolder === folderPath || currentFolder.startsWith(`${folderPath}/`)) {
      setCurrentFolder(parent);
    }
  }

  async function moveAssetToFolder(assetId: string, destinationPath: string) {
    const target = normalizePath(destinationPath);
    if (!target) return;

    await postIntent({ intent: "move-asset", assetId, destinationPath: target });
  }

  async function removeAsset(assetId: string) {
    await postIntent({ intent: "delete-asset", assetId });
  }

  async function copy(text: string) {
    if (!navigator?.clipboard) {
      toast({ title: "Erro", description: "Clipboard indisponível.", variant: "destructive" });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "OK", description: "URL copiada" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  }

  function buildFolderAssetsLink(folderPath: string, kind: "all" | UploadKind = "all") {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = new URL("/api/media/folder-assets", base || "http://localhost");
    url.searchParams.set("folder", folderPath);
    if (kind !== "all") {
      url.searchParams.set("kind", kind);
    }
    return base ? url.toString() : `${url.pathname}${url.search}`;
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border bg-muted/20 p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <FolderTree className="h-5 w-5 md:h-6 md:w-6" />
            Media Drive
          </h1>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="Abrir configurações de mídia">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurações de Mídia</DialogTitle>
                <DialogDescription>
                  Dados de conexão com o serviço externo de upload e entrega pública.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <p><span className="font-medium">Media API:</span> {mediaApiBaseUrl}</p>
                <p><span className="font-medium">Media CDN:</span> {mediaBaseUrl}</p>
                <p><span className="font-medium">Status chave de upload:</span> {hasUploadApiKey ? "configurada" : "não configurada"}</p>
                <p>
                  <span className="font-medium">Healthcheck API:</span>{" "}
                  {mediaApiHealth.ok
                    ? `online (${mediaApiHealth.endpoint} · HTTP ${mediaApiHealth.status})`
                    : `indisponível (${mediaApiHealth.endpoint || "sem resposta"}${mediaApiHealth.status ? ` · HTTP ${mediaApiHealth.status}` : ""})`}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder="Pesquisar em pastas e arquivos"
            className="pl-9 rounded-full bg-background"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Uso total: <span className="font-medium text-foreground">{storageUsage.totalMb} MB</span>
          {storageUsage.unknownCount > 0
            ? ` · ${storageUsage.unknownCount} arquivo(s) sem tamanho registrado`
            : ""}
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 rounded-2xl border p-3 space-y-3">
          <div className="space-y-2 rounded-xl border p-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Criar pasta</p>
              <p className="text-xs text-muted-foreground">
                Digite o nome e clique em criar. A pasta será criada em{" "}
                {currentFolder ? `"${getFolderLabel(currentFolder)}"` : "Meu Drive"}.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                id="newFolderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.currentTarget.value)}
                placeholder="Ex: campanhas"
                className="h-9"
              />
              <Button type="button" className="h-9 px-3" onClick={createFolder}>
                <FolderPlus className="h-4 w-4 mr-1" />
                Criar
              </Button>
            </div>
          </div>

          <TooltipProvider delayDuration={120}>
            <div className="space-y-1 max-h-[520px] overflow-auto pr-1">
            <button
              type="button"
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${!currentFolder ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
              onClick={() => setCurrentFolder("")}
            >
              <Home className="h-4 w-4" />
              Meu Drive
            </button>

            {sidebarFolders.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-2">Nenhuma pasta criada.</p>
            )}

            {sidebarFolders.map((folder) => {
              const depth = folder.split("/").length - 1;
              const isSelected = currentFolder === folder || currentFolder.startsWith(`${folder}/`);

              return (
                <div
                  key={folder}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}
                  style={{ paddingLeft: `${12 + depth * 14}px` }}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 min-w-0 flex-1 text-left"
                    onClick={() => setCurrentFolder(folder)}
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate">{getFolderLabel(folder)}</span>
                  </button>
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            const kind = uploadKind === "video" ? "video" : "all";
                            void copy(buildFolderAssetsLink(folder, kind));
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copiar link da pasta</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            void renameFolderFromList(folder);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Renomear pasta</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-600"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteFolderFromList(folder);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir pasta</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
          </TooltipProvider>
        </aside>

        <div className="lg:col-span-9 rounded-2xl border p-3 md:p-4 space-y-4">
          {lastErrorDebug && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-red-700">Debug da última falha</p>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(lastErrorDebug)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copiar debug
                </Button>
              </div>
              <textarea
                readOnly
                value={lastErrorDebug}
                className="w-full min-h-[110px] rounded-md border bg-white p-2 text-xs font-mono text-red-900"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => setCurrentFolder("")}>
              <Home className="h-3.5 w-3.5" />
              Meu Drive
            </button>
            {breadcrumbs.map((folder) => (
              <span key={folder} className="inline-flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button type="button" className="hover:underline" onClick={() => setCurrentFolder(folder)}>
                  {getFolderLabel(folder)}
                </button>
              </span>
            ))}
          </div>

          <div className="rounded-xl border p-3">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
              <div className="space-y-2 rounded-lg border p-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de Mídia</p>
                <div className="inline-flex items-center rounded-md border p-1 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={uploadKind === "image" ? "default" : "ghost"}
                    className="h-7 px-2"
                    onClick={() => setUploadKind("image")}
                  >
                    <FileImage className="h-3.5 w-3.5 mr-1" />
                    Imagem
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={uploadKind === "video" ? "default" : "ghost"}
                    className="h-7 px-2"
                    onClick={() => setUploadKind("video")}
                  >
                    <FileVideo className="h-3.5 w-3.5 mr-1" />
                    Vídeo
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-2 xl:col-span-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Upload</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="files"
                    name="files"
                    type="file"
                    multiple
                    className="h-9 min-w-[220px] flex-1"
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files || []);
                      setSelectedFiles(files);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isUploadingBatch || !hasUploadApiKey || !currentFolder || selectedFiles.length === 0}
                    className="h-9 gap-2"
                    onClick={uploadBatch}
                  >
                    <Upload className="h-4 w-4" />
                    {isUploadingBatch ? "Enviando..." : "Upload em lote"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border p-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Filtro</p>
                <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as "all" | UploadKind)}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Filtro tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos tipos</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          {uploadQueue.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Progresso do upload</p>
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{item.fileName}</span>
                      <span className={item.status === "error" ? "text-red-600" : "text-muted-foreground"}>
                        {item.status === "pending" && "Na fila"}
                        {item.status === "uploading" && `${item.progress}%`}
                        {item.status === "success" && "Concluído"}
                        {item.status === "error" && (item.message || "Erro")}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${
                          item.status === "error" ? "bg-red-500" : item.status === "success" ? "bg-green-500" : "bg-primary"
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pasta</TableHead>
                <TableHead>Modificado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleFolders.map((folder) => (
                <TableRow key={`folder-${folder}`} className="cursor-pointer" onClick={() => setCurrentFolder(folder)}>
                  <TableCell className="font-medium">
                    <div className="inline-flex items-center gap-2">
                      <Folder className="h-4 w-4 text-amber-500" />
                      {getFolderLabel(folder)}
                    </div>
                  </TableCell>
                  <TableCell>Pasta</TableCell>
                  <TableCell>{getParentPath(folder) || "--"}</TableCell>
                  <TableCell>--</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="ghost">Abrir</Button>
                  </TableCell>
                </TableRow>
              ))}

              {filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">
                    <div className="inline-flex items-center gap-2">
                      {asset.kind === "image" ? (
                        <FileImage className="h-4 w-4 text-sky-600" />
                      ) : (
                        <FileVideo className="h-4 w-4 text-violet-600" />
                      )}
                      <span className="max-w-[320px] truncate">{asset.fileName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{asset.kind === "image" ? "Imagem" : "Vídeo"}</TableCell>
                  <TableCell>{asset.assetPath}</TableCell>
                  <TableCell>{new Date(asset.uploadedAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => copy(asset.url)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Select value={asset.assetPath} onValueChange={(value) => moveAssetToFolder(asset.id, value)}>
                        <SelectTrigger className="h-8 w-[170px] text-xs">
                          <SelectValue placeholder="Mover para..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allFolders.map((folder) => (
                            <SelectItem key={folder} value={folder}>
                              {folder}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeAsset(asset.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {visibleFolders.length === 0 && filteredAssets.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum item encontrado.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
