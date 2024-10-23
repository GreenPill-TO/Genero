import * as React from "react";

import { cn } from "@/lib/classnames";
import { cva, type VariantProps } from "class-variance-authority";

const inputVariants = cva("input bg-background", {
  variants: {
    variant: {
      default: "",
      bordered: "input-bordered",
      ghost: "input-ghost",
      primary: "input-primary",
      secondary: "input-secondary",
      accent: "input-accent",
      success: "input-success",
      warning: "input-warning",
      info: "input-info",
      error: "input-error",
    },
    elSize: {
      xs: "input-xs",
      sm: "input-sm",
      md: "input-md",
      lg: "input-lg",
    },
  },
  defaultVariants: {
    variant: "bordered",
    elSize: "md",
  },
});

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputVariants> {}

const Input: React.FC<InputProps> = ({ variant, elSize, className, ...props }) => {
  return <input className={cn(inputVariants({ variant, elSize }), className)} {...props} />;
};

export { Input };
