import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Campo de texto estándar. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
