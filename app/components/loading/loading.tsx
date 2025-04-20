import { cn } from "~/lib/utils";
import HelixLoaderIcon from "../loader-helix/loader-helix";


interface LoadingProps {
    showText?: boolean
    text?: string
    color?: string
    cnContainer?: string
}

export default function Loading({ showText, text, color = "black", cnContainer }: LoadingProps) {

    let colorIconAndText = color === "black" ? "#111111" : color = "white" ? "#ffffff" : "";

    return (
        <div className={
            cn(
                "flex flex-col gap-6 w-full justify-center items-center min-h-[150px]",
                cnContainer || ""
            )
        }>
            <div className="relative h-[50px] w-[50px]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full">
                    <HelixLoaderIcon color={colorIconAndText} />
                </div>
            </div>
            {
                showText && (
                    <h1 className={
                        cn(
                            "text-xl font-body-website font-semibold tracking-wider",
                            // "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                        )
                    } style={{ color: colorIconAndText }}>{text || "Carregando..."}</h1>
                )
            }
        </div>
    )
}

// export default function Loading({ text }: LoadingProps) {
//     return (
//         <div className="flex flex-col w-full justify-center items-center p-4">
//             <h1 className="text-md font-body-website text-brand-blue font-bold">{text || "Carregando..."}</h1>
//             <HelixLoaderIcon />
//         </div>
//     )
// }