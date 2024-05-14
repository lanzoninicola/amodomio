import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";


interface CopyButtonProps {
    textToCopy: string;
    label?: string
    classNameButton?: string
    classNameLabel?: string
    classNameIcon?: string
    variant?: "ghost" | "default" | "destructive" | "link" | "outline" | "secondary"
    iconSize?: number
    toastTitle?: string
    toastContent?: string
}


const CopyButton = ({ textToCopy, label, variant = "default", classNameButton, classNameLabel, classNameIcon, iconSize, toastTitle, toastContent }: CopyButtonProps) => {
    const [copied, setCopied] = useState(false);

    const copyTextToClipboard = () => {

        if (!navigator?.clipboard) {
            toast({
                title: "Erro",
                description: `Não é possivel copiar`,
            })

            return
        }

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                setCopied(true);

                toast({
                    title: toastTitle || "OK",
                    description: toastContent || "Copiado",
                })

                setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
            })
            .catch(err => console.error('Failed to copy:', err));
    };

    return (

        <Button
            variant={variant}
            className={
                cn(
                    "mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 flex gap-2 hover:text-black",
                    classNameButton
                )
            }
            onClick={copyTextToClipboard}
        >
            <CopyIcon size={iconSize || 16} className={
                cn(
                    "text-black",
                    classNameIcon
                )
            } />
            {label && <span className={
                cn(
                    classNameLabel
                )
            }>{label}</span>}
        </Button>

    );
};

export default CopyButton