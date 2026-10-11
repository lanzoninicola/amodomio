import { createAudioPlayer } from "expo-audio";
import { desktop } from "../platform/desktop";
import { readKdsSoundPreferences } from "../platform/useKdsSoundPreferences.web";
import { KDS_SOUND_KEY } from "../platform/kdsSoundPreferences";
let observingSound = false;
export async function prepareNotifications() {
  if (!desktop || observingSound) return;
  observingSound = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== KDS_SOUND_KEY && event.key !== null) return;
    const sound = readKdsSoundPreferences();
    if (!ovenPlayer) return;
    ovenPlayer.volume = sound.volume;
    if (!sound.enabled || sound.volume === 0) ovenPlayer.pause();
  });
}
export async function notifyNewOrders(numbers: Array<number | null>) {
  try {
    await desktop?.notify(numbers);
  } catch {
    /* Notifications must not interrupt polling. */
  }
  if (desktop && numbers.length) await playKdsSound();
}

let ovenPlayer: ReturnType<typeof createAudioPlayer> | undefined;
export async function notifyAwaitingOven(numbers: Array<number | null>) {
  if (!desktop) return;
  try {
    await desktop.notifyAwaitingOven(numbers);
  } catch {
    // A failed notification must not prevent the sound.
  }
  await playKdsSound();
}

async function playKdsSound() {
  const sound = readKdsSoundPreferences();
  if (!sound.enabled || sound.volume === 0) return;
  try {
    ovenPlayer ??= createAudioPlayer(require("../../assets/oven-alert.wav"));
    ovenPlayer.volume = sound.volume;
    await ovenPlayer.seekTo(0);
    const latest = readKdsSoundPreferences();
    ovenPlayer.volume = latest.volume;
    if (latest.enabled && latest.volume > 0) ovenPlayer.play();
  } catch {
    // A failed sound must not interrupt order updates.
  }
}
