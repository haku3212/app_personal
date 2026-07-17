import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Área de texto multilinea. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[92px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[70px] sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
