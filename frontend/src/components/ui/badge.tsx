import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary",
        success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        danger: "bg-red-500/15 text-red-600 dark:text-red-400",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** Etiqueta pequeña de estado. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
