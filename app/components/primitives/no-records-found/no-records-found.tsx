import { Bird } from "lucide-react";
import { cn } from "~/lib/utils";



interface NoRecordsFoundProps {
    text: string
    additionalInfo?: string
    clazzName?: string
    cnClassName?: string
}

export default function NoRecordsFound({ text, additionalInfo, clazzName, cnClassName }: NoRecordsFoundProps) {
    return (
        <div className={
            cn(
                "grid place-items-center m-4",
                clazzName,
                cnClassName
            )
        }>
            <div className="flex flex-col items-center justify-center gap-4">
                <Bird size={64} strokeWidth={"1px"} className="hover:rotate-6" />
                <div className="flex flex-col items-center justify-center">
                    <h4 className="text-xl font-normal text-gray-500">{text}</h4>
                    {additionalInfo && <p className="text-sm font-normal text-muted-foreground">{additionalInfo}</p>}
                </div>
            </div>
        </div>
    )
}