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
    const whatsappLink = message
        ? `https://wa.me/send?phone=${phoneNumber}&text=${message}`
        : `https://wa.me/${phoneNumber}`;

    const clazzName = style ? style : "relative w-full";

    return (
        <ExternalLink
            to={whatsappLink}
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