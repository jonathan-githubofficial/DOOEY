// Ported from src-legacy/components/ui/button.tsx (unit 2.3). Dropped the old radix Slot /
// polymorphic render-as prop entirely (grep-confirmed no consumer opts into it) - there is no
// DOM/host-element polymorphism concept on Lynx (no <button>/<a> to conditionally render
// as). Dropped: `focus-visible:` ring, `disabled:` variant classes, `hover:` backgrounds -
// Lynx implements only `:active`/`:not()`/`:root` (https://lynxjs.org/api/css/selectors.html);
// replaced by JS-driven `disabled &&` classes + `user-interaction-enabled`. `active:scale-95`
// is kept verbatim (native `:active` support).
import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium font-sans transition-colors active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper",
        outline: "border border-rule bg-transparent text-ink",
        ghost: "text-ink",
        accent: "bg-zest text-paper",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: (e: unknown) => void;
}

/** A bare string/number child would render as a `<raw-text>` directly inside the button
 * `<view>`, which collapses to a 0x0 box on the Lynx web target (only a proper `<text>`
 * lays out as a flex child) - so the label is invisible. Wrap primitive children in a
 * `<text>`; pass element children (icons, or a consumer's own `<text>`) through untouched.
 * Colour + font cascade to the wrapping `<text>` from the button view's variant classes. */
function labelChildren(children: ReactNode): ReactNode {
  const wrap = (c: string | number, key?: number) => (
    <text key={key} className="text-inherit">
      {c}
    </text>
  );
  if (typeof children === "string" || typeof children === "number") return wrap(children);
  if (Array.isArray(children)) {
    return children.map((c, i) => (typeof c === "string" || typeof c === "number" ? wrap(c, i) : c));
  }
  return children;
}

export function Button({ className, variant, size, disabled, onClick, children, ...rest }: ButtonProps) {
  return (
    <view
      bindtap={disabled ? undefined : onClick}
      className={cn(
        buttonVariants({ variant, size }),
        disabled && "opacity-50",
        className,
      )}
      user-interaction-enabled={!disabled}
      {...rest}
    >
      {labelChildren(children)}
    </view>
  );
}

export { buttonVariants };
