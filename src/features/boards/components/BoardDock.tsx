import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/** The board's tool shelf — every tool is a little physical object (Apple
 * Notes / FigJam style), not an icon: a type slug, a sticky note, a paperclip,
 * a peeled sticker, a polaroid, a rubber stamp, a corral, a folder, a pen.
 * Tools rest in the tray and rise when hovered or active. */
export function DockTool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.92 }}
      animate={{ y: active ? -6 : 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className="relative flex h-11 w-9 shrink-0 items-end justify-center pb-1.5"
    >
      {children}
      <span
        className={cn(
          "absolute bottom-0 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-zest transition-opacity",
          active ? "opacity-80" : "opacity-0",
        )}
        aria-hidden
      />
    </motion.button>
  );
}

/* The objects themselves use real-world colors on purpose — a sticky note is
 * yellow and a polaroid is white in dark mode too; they're things, not UI. */

export function TypeSlugGlyph() {
  return (
    <span className="flex h-6.5 w-6.5 -rotate-2 items-center justify-center rounded-[5px] border border-black/10 bg-[#f7f2e9] shadow-[0_1.5px_2px_rgb(40_32_24/0.3)]">
      <span className="font-display text-[14px] font-black leading-none tracking-tight text-[#3a3128]">
        Aa
      </span>
    </span>
  );
}

export function StickyGlyph() {
  return (
    <span className="relative block h-6 w-6 rotate-3 bg-[#ffd977] shadow-[0_1.5px_2.5px_rgb(40_32_24/0.3)]">
      <span
        aria-hidden
        className="absolute bottom-0 right-0 h-2 w-2 bg-[#dfb654] shadow-[-1px_-1px_1.5px_rgb(40_32_24/0.15)]"
        style={{ clipPath: "polygon(0 100%, 100% 0, 0 0)" }}
      />
    </span>
  );
}

export function PaperclipGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6.5 w-6.5 rotate-12 drop-shadow-[0_1px_1px_rgb(40_32_24/0.25)]" aria-hidden>
      <path
        d="M8.5 6.5v9a3.5 3.5 0 0 0 7 0v-10a2.25 2.25 0 0 0-4.5 0v9a1.25 1.25 0 0 0 2.5 0v-8"
        fill="none"
        stroke="#a9b2bd"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StickerGlyph() {
  return (
    <span className="flex h-6.5 w-6.5 -rotate-6 items-center justify-center rounded-full bg-white text-[13px] leading-none shadow-[0_1.5px_2.5px_rgb(40_32_24/0.3)]">
      ⭐
    </span>
  );
}

export function PolaroidGlyph() {
  return (
    <span className="block w-6 -rotate-3 border border-black/10 bg-white p-[2px] pb-[5px] shadow-[0_1.5px_2.5px_rgb(40_32_24/0.3)]">
      <span className="relative block h-[15px] w-full overflow-hidden rounded-[1px] bg-gradient-to-b from-[#9ec7e8] to-[#cfe4b6]">
        <span aria-hidden className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ffd977]" />
      </span>
    </span>
  );
}

export function StampGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 drop-shadow-[0_1px_1.5px_rgb(40_32_24/0.3)]" aria-hidden>
      <rect x="10.2" y="3.5" width="3.6" height="5.5" rx="1.6" fill="#c79c6f" />
      <path d="M8.2 13.5c0-2 1.4-2.6 3.8-2.6s3.8.6 3.8 2.6l.7 3H7.5z" fill="#b0805a" />
      <rect x="5.5" y="16.5" width="13" height="4" rx="1.2" fill="#8a6647" />
    </svg>
  );
}

export function SectionGlyph() {
  return (
    <span className="relative block h-5.5 w-7 rounded-md border-[1.5px] border-dashed border-[#7fb3d6]">
      <span aria-hidden className="absolute left-1 top-0.5 h-1 w-2.5 rounded-full bg-[#7fb3d6]/70" />
    </span>
  );
}

export function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6.5 w-6.5 drop-shadow-[0_1px_1.5px_rgb(40_32_24/0.25)]" aria-hidden>
      <path
        d="M3.5 7.2c0-.9.7-1.7 1.7-1.7h4.1l1.9 1.9h7.6c.9 0 1.7.7 1.7 1.7v8.2c0 .9-.7 1.7-1.7 1.7H5.2c-.9 0-1.7-.7-1.7-1.7z"
        fill="#dfa955"
      />
      <path
        d="M3.5 10.4h17v6.9c0 .9-.7 1.7-1.7 1.7H5.2c-.9 0-1.7-.7-1.7-1.7z"
        fill="#f0c374"
      />
    </svg>
  );
}

export function PenGlyph({ raised }: { raised?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      animate={{ y: raised ? -3 : 0, rotate: raised ? 0 : 8 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className="h-7.5 w-7.5 drop-shadow-[0_1.5px_2px_rgb(40_32_24/0.3)]"
      aria-hidden
    >
      <rect x="10" y="2.5" width="4" height="3" rx="1" fill="#3a3128" />
      <path d="M10 5.5h4V16l-2 5.5L10 16z" fill="#e8762d" />
      <path d="M10.6 16.4h2.8L12 20.3z" fill="#3a3128" />
    </motion.svg>
  );
}
