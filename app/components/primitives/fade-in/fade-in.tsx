import { cn } from "~/lib/utils";



interface FadeInProps
  extends React.HTMLAttributes<HTMLDivElement> { }

export default function FadeIn({ children, className }: FadeInProps) {
  return (
    <div
      className={cn(
        "w-full animate-fadeIn",
        className
      )}
      data-element="fade-in"
    >
      {children}
    </div>
  )
}
