import Container from "~/components/layout/container/container";



export default function AdminIndex() {
    return (
        <Container>
            <div className="flex flex-col gap-16 items-center">
                <h1 className="text-center text-3xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1]">
                    Bem vindo ao painel de administração! 👋🏻
                </h1>
                <h2 className="max-w-[450px] text-center text-lg text-muted-foreground sm:text-xl">
                    Para começar, selecione uma das opções no menu de navegação acima a esquerda. 👆🏻 👈🏻
                </h2>
            </div>
        </Container>
    )
}