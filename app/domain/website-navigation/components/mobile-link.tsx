import { Link, LinkProps } from "@remix-run/react"
import { cn } from "~/lib/utils"

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

export default function MobileLink({
  to,
  onOpenChange,
  className,
  children,
  ...props
}: MobileLinkProps) {
  return (
    <Link
      to={to}
      onClick={() => {
        onOpenChange?.(false)
      }}
      className={cn(className)}
      prefetch={(props as any).prefetch ?? "none"} // garante none por padrão
      {...props}
    >
      {children}
    </Link>
  )
}