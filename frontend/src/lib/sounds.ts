import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useStyleStore } from "@/features/style/store";

// Paper sounds — synthesized noise shaped into a page flip and a pencil
// scratch (see the generation script note in assets/sounds). Off unless the
// Style studio switch is on, quiet always, and they respect the mute switch.
const players: Record<string, AudioPlayer | undefined> = {};
const SOURCES = {
  flip: require("../../assets/sounds/flip.wav"),
  scratch: require("../../assets/sounds/scratch.wav"),
} as const;

function play(kind: keyof typeof SOURCES, volume: number) {
  if (!useStyleStore.getState().sounds) return;
  try {
    const player = (players[kind] ??= createAudioPlayer(SOURCES[kind]));
    player.volume = volume;
    player.seekTo(0);
    player.play();
  } catch {
    // Sound is garnish — it must never break an interaction.
  }
}

export const playFlip = () => play("flip", 0.35);
export const playScratch = () => play("scratch", 0.35);
