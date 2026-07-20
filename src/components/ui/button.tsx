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
      {children}
    </view>
  );
}

export { buttonVariants };
