import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aida-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-aida-action text-aida-action-ink hover:bg-aida-action-hover",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline:
          "border border-aida-brand bg-aida-surface text-aida-brand hover:bg-aida-brand-soft hover:text-aida-brand-soft-ink",
        secondary: "bg-aida-surface-muted text-aida-ink hover:bg-aida-border",
        ghost: "text-aida-ink hover:bg-aida-surface-muted",
        link: "text-aida-link underline-offset-4 hover:underline",
        input:
          'flex h-9 w-full rounded-md border border-aida-border-strong bg-aida-surface px-3 py-1 text-base text-aida-ink transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-aida-ink placeholder:text-aida-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aida-focus data-[state="open"]:ring-2 data-[state="open"]:ring-aida-focus disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={props.type ?? "button"}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
