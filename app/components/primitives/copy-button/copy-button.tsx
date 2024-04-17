import { CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";


interface CopyButtonProps {
    textToCopy: string;
    label?: string
    classNameContainer?: string
    classNameButton?: string
    classNameLabel?: string
    variant?: "ghost" | "default" | "destructive" | "link" | "outline" | "secondary"
}


const CopyButton = ({ textToCopy, label, variant = "default", classNameContainer, classNameButton, classNameLabel }: CopyButtonProps) => {
    const [copied, setCopied] = useState(false);

    const copyTextToClipboard = () => {
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
            })
            .catch(err => console.error('Failed to copy:', err));
    };

    return (
        <div className={
            cn(
                "relative w-max",
                classNameContainer
            )
        }>
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
                <CopyIcon />
                {label && <span className={
                    cn(
                        classNameLabel
                    )
                }>{label}</span>}
            </Button>
            {copied && <span className="absolute -top-4 right-0 text-sm font-semibold">Copiado!</span>}
        </div>
    );
};

export default CopyButton