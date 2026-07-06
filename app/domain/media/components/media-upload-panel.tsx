import { type ChangeEvent, useEffect, useState } from "react";
import { FileAudio, FileImage, FileVideo, Loader2, Upload } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  normalizePath,
  type LibraryPayload,
  type UploadKind,
} from "~/domain/media/media.shared";

type UploadProgressItem = {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  message?: string;
};

type UploadResult =
  | { ok: true; payload: LibraryPayload }
  | { ok: false; message: string };

type MediaUploadPanelProps = {
  allowedKinds?: UploadKind[];
  assetPath: string;
  onUploaded: (payload: LibraryPayload, kind: UploadKind) => void;
  disabled?: boolean;
  disabledMessage?: string;
  className?: string;
};

function getKindLabel(kind: UploadKind) {
  if (kind === "video") return "Vídeo";
  if (kind === "audio") return "Áudio";
  return "Imagem";
}

function getKindIcon(kind: UploadKind) {
  if (kind === "video") return FileVideo;
  if (kind === "audio") return FileAudio;
  return FileImage;
}

function getUploadAccept(kind: UploadKind) {
  if (kind === "video") return "video/*";
  if (kind === "audio") return "audio/*";
  return "image/*";
}

function uploadSingleFile(file: File, kind: UploadKind, assetPath: string, onProgress: (percent: number) => void) {
  return new Promise<UploadResult>((resolve) => {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("assetPath", assetPath);
    formData.append("files", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      let data: {
        ok?: boolean;
        message?: string;
        payload?: LibraryPayload;
      } | null = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data.payload) {
        resolve({ ok: true, payload: data.payload });
        return;
      }

      resolve({
        ok: false,
        message: data?.message || `Falha no upload (status ${xhr.status || "?"}).`,
      });
    };

    xhr.onerror = () => {
      resolve({ ok: false, message: "Erro de rede durante o upload." });
    };

    xhr.send(formData);
  });
}

export default function MediaUploadPanel({
  allowedKinds = ["image", "video", "audio"],
  assetPath,
  onUploaded,
  disabled,
  disabledMessage,
  className,
}: MediaUploadPanelProps) {
  const [uploadKind, setUploadKind] = useState<UploadKind>(
    allowedKinds[0] || "image"
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (allowedKinds.includes(uploadKind)) return;
    setUploadKind(allowedKinds[0] || "image");
  }, [allowedKinds, uploadKind]);

  async function uploadBatch() {
    setErrorMessage(null);
    const normalizedPath = normalizePath(assetPath);

    if (!normalizedPath) {
      setErrorMessage("Selecione uma pasta antes de enviar os arquivos.");
      return;
    }
    if (!selectedFiles.length) {
      setErrorMessage("Selecione ao menos um arquivo.");
      return;
    }

    const queue: UploadProgressItem[] = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      fileName: file.name,
      progress: 0,
      status: "pending",
    }));
    setUploadQueue(queue);
    setIsUploading(true);

    let successCount = 0;
    let failCount = 0;

    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      const file = selectedFiles[index];
      if (!file) continue;

      setUploadQueue((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, status: "uploading", progress: 1 } : row
        )
      );

      const result = await uploadSingleFile(file, uploadKind, normalizedPath, (percent) => {
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, progress: percent, status: "uploading" } : row
          )
        );
      });

      if (result.ok) {
        successCount += 1;
        onUploaded(result.payload, uploadKind);
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === item.id
              ? { ...row, status: "success", progress: 100, message: "Concluído" }
              : row
          )
        );
      } else {
        failCount += 1;
        setUploadQueue((current) =>
          current.map((row) =>
            row.id === item.id
              ? { ...row, status: "error", progress: 100, message: result.message }
              : row
          )
        );
      }
    }

    setIsUploading(false);
    setSelectedFiles([]);
    if (successCount === 0 && failCount > 0) {
      setErrorMessage(`Nenhum arquivo foi enviado (${failCount} falha(s)).`);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {allowedKinds.length > 1 ? (
        <div className="inline-flex min-h-9 items-center rounded-md border bg-background p-1">
          {allowedKinds.map((kind) => {
            const KindIcon = getKindIcon(kind);
            return (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={uploadKind === kind ? "default" : "ghost"}
                className="min-h-7 flex-1 px-2 text-xs"
                onClick={() => setUploadKind(kind)}
                disabled={isUploading}
              >
                <KindIcon className="mr-1 h-3.5 w-3.5" />
                {getKindLabel(kind)}
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          multiple
          accept={getUploadAccept(uploadKind)}
          className="h-9 min-w-[220px] flex-1"
          disabled={isUploading || disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSelectedFiles(Array.from(event.target.files || []));
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-9 gap-2"
          disabled={isUploading || disabled || selectedFiles.length === 0}
          onClick={() => void uploadBatch()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? "Enviando..." : "Enviar"}
        </Button>
      </div>

      {disabled && disabledMessage ? (
        <p className="text-xs text-muted-foreground">{disabledMessage}</p>
      ) : null}

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      {uploadQueue.length > 0 ? (
        <div className="max-h-48 space-y-2 overflow-auto pr-1">
          {uploadQueue.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{item.fileName}</span>
                <span
                  className={
                    item.status === "error"
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }
                >
                  {item.status === "pending" && "Na fila"}
                  {item.status === "uploading" && `${item.progress}%`}
                  {item.status === "success" && "Concluído"}
                  {item.status === "error" && (item.message || "Erro")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full",
                    item.status === "error"
                      ? "bg-red-500"
                      : item.status === "success"
                      ? "bg-green-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
