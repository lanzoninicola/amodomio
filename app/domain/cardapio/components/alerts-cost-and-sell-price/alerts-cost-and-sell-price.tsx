import { AlertCircleIcon, AlertTriangleIcon, InfoIcon } from "lucide-react";
import { MenuItemWithCostVariations, MenuItemWithSellPriceVariations } from "../../menu-item.types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";


interface AlertsCostsAndSellPriceProps {
  items: MenuItemWithCostVariations[] | MenuItemWithSellPriceVariations[];
}

interface Warning {
  type: "info" | "alert" | "critical";
  code: string;
  message: string;
}

export default function AlertsCostsAndSellPrice({ items }: AlertsCostsAndSellPriceProps) {
  const warnings: Warning[] = items.flatMap((item) => item.warnings ?? []);

  if (warnings.length === 0) return null;

  const getIcon = (type: Warning["type"]) => {
    switch (type) {
      case "critical":
        return <AlertCircleIcon className="h-4 w-4 text-red-600" />;
      case "alert":
        return <AlertTriangleIcon className="h-4 w-4 text-yellow-600" />;
      case "info":
      default:
        return <InfoIcon className="h-4 w-4 text-blue-600" />;
    }
  };

  const getTextColor = (type: Warning["type"]) => {
    switch (type) {
      case "critical":
        return "text-red-600";
      case "alert":
        return "text-yellow-700";
      case "info":
        return "text-blue-600";
      default:
        return "text-blue-700";
    }
  };

  return (
    <Accordion
      type="single"
      collapsible
      className="border border-red-500 rounded-md px-4 py-2 mb-4"
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <h3 className="text-md font-semibold text-red-600">
            {`Tem alertas (${warnings.length})`}
          </h3>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-2 mt-2">
            {warnings.map((warning, index) => (
              <li key={index} className="flex gap-2 items-start text-xs">
                {getIcon(warning.type)}
                <span className={getTextColor(warning.type)}>{warning.message}</span>
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}