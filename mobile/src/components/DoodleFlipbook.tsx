import { useEffect, useState } from "react";
import { DoodleSvg } from "@/components/DoodleSvg";
import type { Stroke } from "@/lib/doodle";

/** Plays doodled frames as a hand-drawn loop — the flipbook the companion and
 * the wordmark animation share. A single frame just holds still. */
export function DoodleFlipbook({
  frames,
  interval = 550,
  strokeWidth,
}: {
  frames: Stroke[][];
  interval?: number;
  strokeWidth?: number;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), interval);
    return () => clearInterval(t);
  }, [frames.length, interval]);
  if (frames.length === 0) return null;
  return <DoodleSvg strokes={frames[frame % frames.length]} strokeWidth={strokeWidth} />;
}
