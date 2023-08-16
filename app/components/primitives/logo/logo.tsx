

interface LogoProps {
    color?: "white" | "black"
}


export default function Logo({ color = "white" }: LogoProps) {
    return <img src={`/images/logo-${color}.svg`} alt="Logo A Modo Mio" />
}