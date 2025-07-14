import { useSound } from "./use-sound";

// Hook para componentes que fazem ações específicas - ATUALIZADO
export function useSoundEffects() {
  const { playSound } = useSound();

  return {
    // Sons originais
    playClick: () => playSound("click"),
    playHover: () => playSound("hover"),
    playSuccess: () => playSound("success"),
    playLike: () => playSound("like"),
    playShare: () => playSound("share"),
    playNavigation: () => playSound("navigation"),
    playFilter: () => playSound("filter"),
    playError: () => playSound("error"),
    playNotification: () => playSound("notification"),
    playSlideIn: () => playSound("slide-in"),
    playSlideOut: () => playSound("slide-out"),

    // 🆕 NOVOS SONS MECÂNICOS
    playTap: () => playSound("tap"), // Som suave tipo touch
    playTick: () => playSound("tick"), // Som seco tipo relógio
    playClik: () => playSound("clik"), // Som agudo tipo switch
    playPop: () => playSound("pop"), // Som tipo bolha/botão
    playSnap: () => playSound("snap"), // Som tipo estalo crisp
  };
}
