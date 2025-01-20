import ItalyFlag from "~/components/italy-flag/italy-flag"
import { cn } from "~/lib/utils"

interface ItalyIngredientsStatementProps {
    cnText?: string
}


const ItalyIngredientsStatement = ({ cnText }: ItalyIngredientsStatementProps) => {
    return (
        <div className="flex gap-2 items-center">
            <div className="flex self-start ">
                <ItalyFlag width={24} />
            </div>
            <p className={
                cn(
                    "font-body-website leading-tight text-muted-foreground ",
                    cnText
                )
            }>Este sabor contém ingredientes adicionais importados da Itália.</p>
        </div>
    )
}

export default ItalyIngredientsStatement