import ItalyFlag from "~/components/italy-flag/italy-flag"
import { cn } from "~/lib/utils"

interface ItalyIngredientsStatementProps {
    cnText?: string,
    showText?: boolean
}


const ItalyIngredientsStatement = ({ cnText, showText = true }: ItalyIngredientsStatementProps) => {
    return (
        <div className="flex gap-2 items-center my-2">
            <div className="flex self-start ">
                <ItalyFlag width={24} />
            </div>
            {showText && <p className={
                cn(
                    "text-[13px] tracking-wide font-neue leading-tight text-muted-foreground ",
                    cnText
                )
            }>Este sabor contém ingredientes adicionais importados da Itália.</p>}
        </div>
    )
}

export default ItalyIngredientsStatement