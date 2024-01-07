import { cn } from "~/lib/utils";

interface ExternalLinkProps {
    to: string;
    children: React.ReactNode;
    ariaLabel: string;
    className?: string
    [key: string]: any;
}

export default function ExternalLink({
    to,
    children,
    ariaLabel,
    className,
    ...props
}: ExternalLinkProps) {
    return (
        <a
            href={to}
            aria-label={ariaLabel}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                className
            )}
            {...props}
        >
            {children}
        </a>
    );
}