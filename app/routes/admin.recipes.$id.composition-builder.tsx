import { useOutletContext } from "@remix-run/react";
import { useState } from "react";
import ExternalRecipeChatGptAssistantPanel from "~/domain/recipe/components/external-recipe-chatgpt-assistant-panel";
import RecipeChatGptAssistantPanel from "~/domain/recipe/components/recipe-chatgpt-assistant-panel";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { AdminRecipeOutletContext } from "~/routes/admin.recipes.$id";

export default function RecipeCompositionBuilderRoute() {
  const { recipe } = useOutletContext<AdminRecipeOutletContext>();
  const isYieldMode = String((recipe as any)?.costingMode || "") === "yield";
  const [assistant, setAssistant] = useState<"composition" | "external">(
    "composition"
  );
  const options = [
    {
      value: "composition" as const,
      title: "Composição atual",
      description: "Usa a composição definida para sugerir as quantitades.",
    },
    {
      value: "external" as const,
      title: "Receita sugerida",
      description:
        "Usa uma receita criada no ChatGPT para criar itens faltantes e preencher esta receita.",
    },
  ];
  const assistantChoiceContent = (
    <div className="grid gap-4 md:grid-cols-2">
      {options.map((option) => {
        const isActive = assistant === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            onClick={() => setAssistant(option.value)}
            className={cn(
              "h-auto justify-start rounded-lg border-slate-200 bg-white p-5 text-left hover:bg-slate-50",
              isActive && "border-slate-900 bg-slate-50"
            )}
          >
            <span className="space-y-2">
              <span className="block text-sm font-semibold text-slate-900">
                {option.title}
              </span>
              <span className="block whitespace-normal text-xs font-normal leading-5 text-slate-500">
                {option.description}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );

  return (
    <div className="pb-8">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">
          Modalidade detectada:{" "}
        </span>
        {isYieldMode ? "por rendimento" : "por variação/tamanho"}.
        {isYieldMode ? (
          <span>
            {" "}
            O builder considera o lote de{" "}
            {Number((recipe as any)?.yieldQuantity || 0).toLocaleString(
              "pt-BR"
            )}{" "}
            {String((recipe as any)?.yieldUnit || "UM").toUpperCase()} e a
            eventual perda de cada ingrediente.
          </span>
        ) : null}
      </div>
      {assistant === "composition" ? (
        <RecipeChatGptAssistantPanel
          assistantChoiceContent={assistantChoiceContent}
          assistantChoiceLabel="atual"
        />
      ) : (
        <ExternalRecipeChatGptAssistantPanel
          assistantChoiceContent={assistantChoiceContent}
          assistantChoiceLabel="sugerida"
        />
      )}
    </div>
  );
}
