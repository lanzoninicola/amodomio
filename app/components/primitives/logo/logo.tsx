import { cn } from "~/lib/utils"


interface LogoProps {
    color?: "white" | "black"
    className?: string
    tagline?: boolean
}


export default function Logo({ color = "white", className, tagline = true }: LogoProps) {

    const fileName = tagline ? `logo-${color}.svg` : `logo-${color}-no-tagline.svg`

    return <img src={`/images/${fileName}`} alt="Logo A Modo Mio"
        className={
            cn(
                className
            )
        }
    />
}