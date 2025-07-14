import { useSound } from "./use-sound";

// Hook para componentes que fazem ações específicas
export function useSoundEffects() {
  const { playSound } = useSound();

  return {
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
  };
}
