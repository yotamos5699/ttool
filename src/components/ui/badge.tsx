import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        stage: "border-transparent bg-stage/20 text-stage",
        job: "border-transparent bg-job/20 text-job",
        context: "border-transparent bg-context/20 text-context",
        warning: "border-transparent bg-warning/20 text-warning",
        pending: "border-transparent bg-muted text-muted-foreground",
        running: "border-transparent bg-blue-500/20 text-blue-600 dark:text-blue-400",
        completed: "border-transparent bg-green-500/20 text-green-600 dark:text-green-400",
        failed: "border-transparent bg-red-500/20 text-red-600 dark:text-red-400",
        cancelled: "border-transparent bg-gray-500/20 text-gray-600 dark:text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
