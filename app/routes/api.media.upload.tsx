import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/domain/auth/google.server";
import {
  formatUnsupportedMediaUploadMessage,
  getMediaUploadFailureMessage,
  getMediaUploadPartialFailureMessage,
  getMediaUploadFailureStatus,
  getUnsupportedMediaUploadMessages,
  isSafePath,
  MEDIA_UPLOAD_MAX_BYTES,
  normalizePath,
  type LibraryPayload,
  type UploadKind,
} from "~/domain/media/media.shared";

type UploadActionData =
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

function toUploadKind(value: string): UploadKind {
  if (value === "video") return "video";
  if (value === "audio") return "audio";
  return "image";
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request);

  if (request.method !== "POST") {
    return json<UploadActionData>(
      { ok: false, message: "Método não permitido." },
      { status: 405 }
    );
  }

  if (!process.env.MEDIA_UPLOAD_API_KEY) {
    return json<UploadActionData>(
      {
        ok: false,
        message:
          "Configure MEDIA_UPLOAD_API_KEY no servidor para habilitar upload.",
      },
      { status: 500 }
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return json<UploadActionData>(
      { ok: false, message: "Envie os arquivos como multipart/form-data." },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter(
        (entry): entry is File => entry instanceof File && entry.size > 0
      );
    const kind = toUploadKind(String(formData.get("kind") || "image"));
    const assetPath = normalizePath(String(formData.get("assetPath") || ""));

    if (files.length === 0) {
      return json<UploadActionData>(
        { ok: false, message: "Selecione ao menos um arquivo para upload." },
        { status: 400 }
      );
    }

    const oversizedFiles = files.filter(
      (file) => file.size > MEDIA_UPLOAD_MAX_BYTES
    );
    if (oversizedFiles.length) {
      return json<UploadActionData>(
        {
          ok: false,
          message: `${oversizedFiles
            .map((file) => file.name)
            .join(", ")}: o tamanho máximo por arquivo é 100 MB.`,
        },
        { status: 413 }
      );
    }

    if (!isSafePath(assetPath)) {
      return json<UploadActionData>(
        {
          ok: false,
          message: "Selecione uma pasta válida antes de enviar o arquivo.",
        },
        { status: 400 }
      );
    }

    const unsupportedFiles = getUnsupportedMediaUploadMessages(files, kind);
    if (unsupportedFiles.length > 0) {
      return json<UploadActionData>(
        {
          ok: false,
          message: formatUnsupportedMediaUploadMessage(unsupportedFiles),
          debug: JSON.stringify({ unsupportedFiles }, null, 2),
        },
        { status: 415 }
      );
    }

    const mediaService = await import("~/domain/media/media.service.server");
    const { successCount, failedFiles, failureDetails, payload } =
      await mediaService.uploadFilesToExternalService({
        files,
        kind,
        assetPath,
      });

    if (successCount === 0) {
      return json<UploadActionData>(
        {
          ok: false,
          message: getMediaUploadFailureMessage({
            failedFiles,
            failureDetails,
          }),
          debug: JSON.stringify({ failedFiles, failureDetails }, null, 2),
        },
        { status: getMediaUploadFailureStatus({ failureDetails }) }
      );
    }

    const failureMessage = getMediaUploadPartialFailureMessage({
      failedFiles,
      failureDetails,
    });

    return json<UploadActionData>({
      ok: true,
      message: `Upload concluído. Enviados: ${successCount}/${files.length}.${failureMessage}`,
      payload,
    });
  } catch (error) {
    return json<UploadActionData>(
      {
        ok: false,
        message: "Não foi possível concluir o upload.",
        debug: String((error as Error)?.message || "unknown_upload_error"),
      },
      { status: 500 }
    );
  }
}
