import { cn } from "~/lib/utils";
import HelixLoaderIcon from "../loader-helix/loader-helix";


interface LoadingProps {
    showText?: boolean
    text?: string
}

export default function Loading({ showText, text }: LoadingProps) {
    return (
        <div className="relative h-[50px]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full">
                <HelixLoaderIcon />
            </div>
            {
                showText && (
                    <h1 className={
                        cn(
                            "text-xl font-body-website text-brand-blue font-semibold",
                            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                        )
                    }>{text || "Carregando..."}</h1>
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