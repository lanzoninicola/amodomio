import { useRef, useEffect, useCallback } from "react";
import { SoundManager, SoundOptions } from "./sound-manager";

// Instância global do gerenciador de sons
let globalSoundManager: SoundManager | null = null;

export function useSound(options: SoundOptions = {}) {
  const soundManagerRef = useRef<SoundManager | null>(null);

  useEffect(() => {
    if (!globalSoundManager) {
      globalSoundManager = new SoundManager(options);
    }
    soundManagerRef.current = globalSoundManager;
  }, []);

  const playSound = useCallback(async (soundType: string) => {
    if (!soundManagerRef.current) return;

    const manager = soundManagerRef.current;

    switch (soundType) {
      case "click":
        await manager.playClick();
        break;
      case "hover":
        await manager.playHover();
        break;
      case "success":
        await manager.playSuccess();
        break;
      case "like":
        await manager.playLike();
        break;
      case "share":
        await manager.playShare();
        break;
      case "navigation":
        await manager.playNavigation();
        break;
      case "filter":
        await manager.playFilter();
        break;
      case "error":
        await manager.playError();
        break;
      case "notification":
        await manager.playNotification();
        break;
      case "slide-in":
        await manager.playSlideIn();
        break;
      case "slide-out":
        await manager.playSlideOut();
        break;
      // 🆕 NOVOS SONS
      case "tap":
        await manager.playTap();
        break;
      case "tick":
        await manager.playTick();
        break;
      case "clik":
        await manager.playClik();
        break;
      case "pop":
        await manager.playPop();
        break;
      case "snap":
        await manager.playSnap();
        break;
      default:
        console.warn(`Som não encontrado: ${soundType}`);
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    soundManagerRef.current?.setVolume(volume);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    soundManagerRef.current?.setEnabled(enabled);
  }, []);

  const getEnabled = useCallback(() => {
    return soundManagerRef.current?.getEnabled() || false;
  }, []);

  const getVolume = useCallback(() => {
    return soundManagerRef.current?.getVolume() || 0;
  }, []);

  return {
    playSound,
    setVolume,
    setEnabled,
    getEnabled,
    getVolume,
  };
}