import { cn } from "~/lib/utils";
import WhatsappExternalLink from "./whatsapp-external-link";
import WhatsAppIcon from "./whatsapp-icon";


interface WhatsAppButtonExtendedProps {
    label: string
    className?: string
    message: string
}

export default function WhatsAppButtonExtended({ label, className, message }: WhatsAppButtonExtendedProps) {

    return (
        <WhatsappExternalLink phoneNumber="46991272525" ariaLabel="Envia uma mensagem com WhatsApp" message={message}>
            <div
                className={cn(
                    "grid place-items-center rounded-md h-[48px] w-full bg-green-500 shadow-xl",
                    className
                )}
            >
                <div className="flex gap-4 items-center">
                    <span className="text-white uppercase font-semibold text-sm tracking-wide">{label}</span>
                    <WhatsAppIcon />
                </div>
            </div>
        </WhatsappExternalLink>
    )
}