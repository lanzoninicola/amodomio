export default function CardapioPizzaAlTaglioNew() {
    return (
        <div className="flex flex-col gap-6">
            <h3 className="text-xl font-semibold text-muted-foreground mb-3">Nova categoria</h3>
            <div className="border rounded-md p-4">
                <CategoryForm action={"category-create"} />
            </div>
        </div>
    )
}