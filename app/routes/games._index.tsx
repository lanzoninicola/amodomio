import { Link } from "@remix-run/react"




export default function GamesIndex() {
    return (
        <div className="flex flex-col gap-4 text-white">
            <h1 className="text-2xl tracking-tight font-semibold">Selecione o jogo</h1>
            <ul className="text-white text-lg">
                <Link to="/games/jogo-da-velha">
                    <li>Jogo da velha</li>
                </Link>

            </ul>
        </div>
    )
}