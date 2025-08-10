import Logo from "~/components/primitives/logo/logo"

export function loader() {
  return null
}

export default function DiaDosPais() {

  return (
    <div className="w-screen h-screen grid place-items-center font-neue tracking-wide text-xl md:text-2xl">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center md:gap-1">
          <p>Para todos os tipos de <strong>pais</strong></p>
          <p>e para todas as <strong>memórias</strong></p>
          <p>que guardamos no coração,</p>
          <p>um <strong>feliz Dia dos Pais</strong></p>
        </div>
        <div className="w-[120px] md:w-[150px]">
          <Logo color="black" circle={true} />
        </div>
      </div>

    </div>
  )
}