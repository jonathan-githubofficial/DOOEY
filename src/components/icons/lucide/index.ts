// Hand-authored inline Lynx <svg> icon barrel (unit 2.4 decision B - lucide-react's
// composed <svg>/<path> output does not render as real SVG through the Lynx web-elements
// host; see this unit's commit message for the smoke-test finding). One file per icon,
// transcribed verbatim from the installed lucide-react package's __iconNode data.
//
// NOTE (web-target colour parity gap, this unit's finding): each icon's SVG XML is
// rendered via the `<svg>` host element's `content` prop, which `@lynx-js/web-elements`
// XSvg turns into a blob-URL `<img>` - that sandboxes `currentColor` to the browser
// default (black) on web; the `current-color` override prop is native-only per
// `@lynx-js/types` (no `@web` in its platform list). So on web, these icons render in
// black regardless of a consumer's `text-*` className until unit 8.5 wires native
// `current-color` theming (or a future unit adds a web-specific recolor workaround).
export { Check } from "./check";
export { Eraser } from "./eraser";
export { Pencil } from "./pencil";
export { Undo2 } from "./undo-2";
export { X } from "./x";
export { NotebookPen } from "./notebook-pen";
export { CalendarDays } from "./calendar-days";
export { FolderOpen } from "./folder-open";
export { Shapes } from "./shapes";
export { UserRound } from "./user-round";
export { ArrowLeft } from "./arrow-left";
export { Trash2 } from "./trash-2";
export { Loader2 } from "./loader-2";
export { Paperclip } from "./paperclip";
export { Plus } from "./plus";
export { ChevronLeft } from "./chevron-left";
export { ChevronRight } from "./chevron-right";
export { Minus } from "./minus";
export { Link2 } from "./link-2";
export { ListChecks } from "./list-checks";
export { StickyNote } from "./sticky-note";
export { Maximize2 } from "./maximize-2";
export { Palette } from "./palette";
export { LogOut } from "./log-out";
export { Moon } from "./moon";
export { Sun } from "./sun";
export { ArrowUpRight } from "./arrow-up-right";
export { Clock } from "./clock";
export { ExternalLink } from "./external-link";
export { RotateCw } from "./rotate-cw";
export { ImagePlus } from "./image-plus";
export { RotateCcw } from "./rotate-ccw";
export { ChevronUp } from "./chevron-up";
export { MoreHorizontal } from "./more-horizontal";
export { Paintbrush } from "./paintbrush";
export { Upload } from "./upload";
export { ArrowUpFromLine } from "./arrow-up-from-line";
export { Download } from "./download";
export { ChevronDown } from "./chevron-down";
export { BookOpen } from "./book-open";
export { Dumbbell } from "./dumbbell";
export { GraduationCap } from "./graduation-cap";
export { Languages } from "./languages";

export type IconComponent = (props: { className?: string }) => JSX.Element;
