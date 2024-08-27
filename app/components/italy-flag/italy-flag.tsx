import { cn } from "~/lib/utils"



interface ItalyFlagProps {
    width?: number | undefined
    className?: string
}

export default function ItalyFlag({ width, className }: ItalyFlagProps) {

    const defaultWidth = 1500
    const defaultHeight = 1000

    const widthSvg = width || defaultWidth
    const heightSvg = widthSvg * 1.5 || defaultHeight



    return (

        <svg xmlns="http://www.w3.org/2000/svg" width={widthSvg} height={heightSvg} viewBox="0 0 3 2" className={cn("inline-block", className)}>
            <rect width="3" height="2" fill="#009246" />
            <rect width="2" height="2" x="1" fill="#fff" />
            <rect width="1" height="2" x="2" fill="#ce2b37" />
        </svg>

    )
}