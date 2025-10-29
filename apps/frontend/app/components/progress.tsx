import * as React from "react"
import { cn } from "../utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value = 0, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <div
      className="h-full bg-accent transition-all"
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
