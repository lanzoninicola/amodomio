import { cn } from "~/lib/utils";


interface ContainerProps {
    children: React.ReactNode;
    clazzName?: React.StyleHTMLAttributes<HTMLDivElement>["className"];
    className?: string
}

export default function Container({ children, clazzName, className }: ContainerProps) {
    return (
        <div className={
            cn(
                `relative md:max-w-[1024px] left-1/2 -translate-x-1/2 p-4 lg:p-0 ${clazzName}`,
                className
            )
        }
            data-element="container">
            {children}
        </div>
    )
}

