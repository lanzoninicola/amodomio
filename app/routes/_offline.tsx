import Logo from "~/components/primitives/logo/logo"

export default function WpaOffline() {
    return (
        <div className="w-screen h-screen grid place-items-center">
            <div className="grid grid-rows-6 w-full h-full items-center justify-center">
                <Logo color="black" onlyText={true} className="w-[250px]" />
                <div className="col-span-2 row-span-2">
                    <h1 className="text-center text-3xl font-bold">Você está offline</h1>
                </div>
                <div className="col-span-2 row-span-2">
                    <p className="text-center text-lg">Verifique sua conexão com a internet.</p>
                </div>
            </div>

        </div>
    )
}