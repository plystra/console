import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center border px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-foreground bg-foreground text-background",
      outline: "border-border bg-background text-foreground",
      muted: "border-border bg-muted text-muted-foreground",
      danger: "border-destructive bg-destructive text-destructive-foreground",
    },
  },
  defaultVariants: {
    variant: "outline",
  },
});

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
