import { cn } from "~/lib/utils";
import WhatsappExternalLink from "./whatsapp-external-link";
import WhatsAppIcon from "./whatsapp-icon";


interface WhatsAppButtonProps
    extends React.HTMLAttributes<HTMLDivElement> { }


export default function WhatsAppButton({ className, ...props }: WhatsAppButtonProps) {

    return (
        <WhatsappExternalLink phoneNumber="46991272525" ariaLabel="Envia uma mensagem com WhatsApp">
            <div
                className={cn(
                    "grid place-items-center rounded-full h-[48px] w-[48px] bg-green-500 shadow-xl",
                    className
                )}
                {...props}
            >
                <WhatsAppIcon />
            </div>
        </WhatsappExternalLink>

    )
}


