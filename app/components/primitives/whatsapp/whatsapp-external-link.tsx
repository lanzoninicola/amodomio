import { cn } from "~/lib/utils";
import ExternalLink from "../external-link/external-link";


interface WhatsappExternalLinkProps {
    phoneNumber: string
    ariaLabel: string;
    message?: string;
    children: React.ReactNode;
    className?: string
    style?: string
}

export default function WhatsappExternalLink({
    phoneNumber,
    ariaLabel,
    message,
    children,
    className,
    style
}: WhatsappExternalLinkProps) {
    // https://faq.whatsapp.com/5913398998672934?helpref=faq_content
    // https://wa.me/whatsappphonenumber/?text=urlencodedtext

    let waLink = `https://wa.me/${phoneNumber}`
    if (message) {
        waLink += `?text=${encodeURIComponent(message)}`
    }

    return (
        <ExternalLink
            to={waLink}
            ariaLabel={`${ariaLabel} com WhatsApp`}
            className={cn(
                className
            )}
            data-element="whatsapp-link"
        >
            {children}
        </ExternalLink>
    );
}