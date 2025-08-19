import Logo from "~/components/primitives/logo/logo"

export function loader() {
  return null
}

export default function DiaDosPais() {

  return (
    <div
      className="w-screen h-screen font-neue tracking-wide text-xl md:text-2xl bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(/images/dia-dos-pais.svg)' }} // Aqui você define a imagem de fundo
    >
      {/* Camada semitransparente para aumentar o contraste */}
      <div className="absolute inset-0 bg-white opacity-70"></div> {/* A camada com opacidade */}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
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
