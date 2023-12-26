import { Save, Trash } from "lucide-react";
import Tooltip from "~/components/primitives/tooltip/tooltip";
import { Button } from "~/components/ui/button";

interface SaveItemButtonProps {
    actionName: string;
    iconSize?: number;
    clazzName?: string
}

export default function SaveItemButton({ actionName, iconSize, clazzName }: SaveItemButtonProps) {
    return (
        <Tooltip content="Salvar">
            <Button type="submit" variant={"ghost"} size="sm" name="_action" value={actionName}
                className={`text-black hover:bg-gray-200 ${clazzName}`}>
                <Save size={iconSize || 16} />
            </Button>
        </Tooltip>
    )
}