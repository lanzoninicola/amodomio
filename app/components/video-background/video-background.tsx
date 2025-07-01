import { cn } from "~/lib/utils";

interface VideoBackgroundProps {
  /** The video url */
  src: string
  overlay: boolean
  cnContainer?: string
  cnVideo?: string
}

export default function VideoBackground({ src, overlay = true, cnContainer, cnVideo }: VideoBackgroundProps) {

  return (
    <>
      <div className={cn("md:hidden", cnContainer)}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className={cn("w-screen h-screen object-cover z-[-1]", cnVideo)}
          poster="/images/cardapio-web-app/amodomio-hero-f000000.png"
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>
      <div className={cn("hidden md:block", cnContainer)}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className={cn("w-screen h-screen object-cover z-[-1]", cnVideo)}
          poster="/images/cardapio-web-app/amodomio-hero-f000000.png"
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>
      {overlay && (
        <div className="absolute inset-0 overflow-hidden rotate-0 opacity-40 bg-black"
          data-element="video-overlay"
        />
      )}
    </>
  );
}