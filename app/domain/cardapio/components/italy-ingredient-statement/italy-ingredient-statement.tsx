import ItalyFlag from "~/components/italy-flag/italy-flag"

const ItalyIngredientsStatement = () => {
    return (
        <div className="flex gap-2 items-center">
            <div className="flex self-start ">
                <ItalyFlag width={24} />
            </div>
            <p className="font-body-website leading-tight text-muted-foreground text-xs">Este sabor contém ingredientes adicionais importados da Itália.</p>
        </div>
    )
}

export default ItalyIngredientsStatement