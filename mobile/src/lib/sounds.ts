import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { useStyleStore } from "@/features/style/store";

// Paper sounds — synthesized noise shaped into a page flip and a pencil
// scratch (see the generation script note in assets/sounds). Off unless the
// Style studio switch is on, quiet always, and they respect the mute switch.
let flip: AudioPlayer | null = null;
let scratch: AudioPlayer | null = null;

function play(kind: "flip" | "scratch") {
  if (!useStyleStore.getState().sounds) return;
  try {
    if (kind === "flip") flip ??= createAudioPlayer(require("../../assets/sounds/flip.wav"));
    else scratch ??= createAudioPlayer(require("../../assets/sounds/scratch.wav"));
    const player = kind === "flip" ? flip! : scratch!;
    player.volume = 0.35;
    player.seekTo(0);
    player.play();
  } catch {
    // Sound is garnish — it must never break an interaction.
  }
}

export const playFlip = () => play("flip");
export const playScratch = () => play("scratch");
