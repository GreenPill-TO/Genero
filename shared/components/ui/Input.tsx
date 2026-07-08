import * as React from "react"

import { cn } from "@shared/lib/utils"
import { inputFieldClass } from "./formFieldStyles"

type InputProps = React.ComponentProps<"input"> & {
  elSize?: string
  label?: string
  variant?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, elSize: _elSize, label: _label, variant: _variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          inputFieldClass,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
