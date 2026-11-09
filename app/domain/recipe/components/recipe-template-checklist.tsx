import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

type ChecklistState = Record<string, string[]>;
const ChecklistContext = createContext<{
  state: ChecklistState;
  setState: Dispatch<SetStateAction<ChecklistState>>;
} | null>(null);

export function RecipeTemplateChecklistProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<ChecklistState>({});
  return (
    <ChecklistContext.Provider value={{ state, setState }}>
      {children}
    </ChecklistContext.Provider>
  );
}

export function useRecipeTemplateChecklist(templateId: string) {
  const context = useContext(ChecklistContext);
  if (!context) throw new Error("Checklist provider is missing");
  return {
    addedIds: context.state[templateId] || [],
    toggle: (id: string) =>
      context.setState((current) => {
        const added = current[templateId] || [];
        return {
          ...current,
          [templateId]: added.includes(id)
            ? added.filter((entry) => entry !== id)
            : [...added, id],
        };
      }),
    reset: () =>
      context.setState((current) => ({ ...current, [templateId]: [] })),
  };
}
