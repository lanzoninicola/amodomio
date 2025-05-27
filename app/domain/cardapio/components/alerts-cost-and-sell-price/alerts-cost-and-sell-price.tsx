import { AlertCircleIcon, AlertTriangleIcon, CircleAlert, InfoIcon } from "lucide-react";
import { MenuItemWithCostVariations, MenuItemWithSellPriceVariations } from "../../menu-item.types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";


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
    <>
      <Dialog>
        <DialogTrigger asChild className="w-full">
          <button className="relative w-max pr-2 py-1">
            <CircleAlert className="text-red-500" />
            <div className="absolute top-0 right-0 rounded-full bg-red-500 w-[18px] h-[18px] p-0 grid place-items-center">
              <p className="text-[10px] font-semibold text-white m-o p-0 leading-none">
                {warnings.length}
              </p>
            </div>

          </button>
        </DialogTrigger>
        <DialogContent className="p-8 bg-white border-none">
          <ul className="flex flex-col gap-2 mt-2 overflow-y-scroll h-[450px]">
            {warnings.map((warning, index) => (
              <li key={index} className="flex gap-2 items-start text-xs">
                {getIcon(warning.type)}
                <span className={getTextColor(warning.type)}>{warning.message}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      {/* <Accordion
        type="single"
        collapsible
        className="border border-red-500 rounded-md px-4 py-2 mb-4"
      >
        <AccordionItem value="item-1">
          <AccordionTrigger>
            <div className="flex items-center text-md font-semibold text-red-600 gap-x-1">
              {warnings.length}
              <CircleAlert />

            </div>
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
      </Accordion> */}
    </>
  );
}

