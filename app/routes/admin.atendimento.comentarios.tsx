import { useEffect, useRef, useState, useTransition } from "react";
import { Form, json, redirect, useSubmit, } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest } from "~/utils/http-response.server";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const sentiment = formData.get("sentiment")?.toString();
  const imageBase64 = formData.get("imageBase64")?.toString();

  if (!sentiment || !imageBase64) {
    return badRequest("Dados incompletos");
  }

  await prismaClient.feedback.create({
    data: { sentiment, imageBase64 },
  });

  return redirect("/admin/atendimento/comentarios");
};

export default function FeedbackForm() {
  const [sentiment, setSentiment] = useState<"positive" | "negative">("positive");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useSubmit();
  const transition = useTransition();

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const item = Array.from(items).find(i => i.type.indexOf("image") !== -1);
      if (!item) return;

      const file = item.getAsFile();
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageBase64(base64);

        const form = inputRef.current?.form;
        if (form) {
          const formData = new FormData(form);
          formData.set("sentiment", sentiment);
          formData.set("imageBase64", base64);
          submit(formData, { method: "post" });
        }
      };
      reader.readAsDataURL(file);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageBase64(base64);

        const form = inputRef.current?.form;
        if (form) {
          const formData = new FormData(form);
          formData.set("sentiment", sentiment);
          formData.set("imageBase64", base64);
          submit(formData, { method: "post" });
        }
      };
      reader.readAsDataURL(file);
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [sentiment]);

  return (
    <div className="max-w-2xl mx-auto">
      <Form method="post">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 space-y-8">
          {/* Tipo de comentário */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Tipo de comentário
            </label>
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setSentiment("positive")}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-200",
                    sentiment === "positive"
                      ? "bg-green-500 text-white shadow-lg transform scale-105"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Positivo
                </button>
                <button
                  type="button"
                  onClick={() => setSentiment("negative")}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all duration-200",
                    sentiment === "negative"
                      ? "bg-red-500 text-white shadow-lg transform scale-105"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Negativo
                </button>
              </div>
            </div>
          </div>

          {/* Área de upload */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Captura de tela
            </label>
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center",
                isDragOver
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : imageBase64
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
              )}
            >
              {imageBase64 ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Imagem capturada com sucesso!
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Pronto para envio
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cole sua captura de tela aqui
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Arraste e solte ou use Ctrl + V
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inputs ocultos */}
          <input type="hidden" name="sentiment" value={sentiment} />
          <input type="hidden" name="imageBase64" value={imageBase64 ?? ""} ref={inputRef} />

          {/* Botão de envio */}
          <div className="space-y-4">
            <Button
              type="submit"
              disabled={!imageBase64 || transition.state === "submitting"}
              className={cn(
                "w-full py-4 text-base font-semibold rounded-xl transition-all duration-200 transform",
                imageBase64
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl hover:scale-105"
                  : "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
              )}
            >
              {transition.state === "submitting" ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Enviando...
                </div>
              ) : (
                "Enviar Feedback"
              )}
            </Button>
          </div>

          {/* Instruções */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium mb-1">Como enviar seu feedback:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Pressione <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border rounded text-xs font-mono">Ctrl + V</kbd> para colar uma captura de tela</li>
                  <li>• Ou arraste e solte uma imagem diretamente na área acima</li>
                  <li>• Escolha se seu feedback é positivo ou negativo</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}