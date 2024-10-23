import * as React from "react";

import { cn } from "@/lib/classnames";
import { cva, type VariantProps } from "class-variance-authority";
import { Label } from "./Label";

const radioVariants = cva("radio", {
  variants: {
    variant: {
      default: "",
      primary: "radio-primary",
      secondary: "radio-secondary",
      accent: "radio-accent",
      success: "radio-success",
      warning: "radio-warning",
      info: "radio-info",
      error: "radio-error",
    },
    size: {
      xs: "radio-xs",
      sm: "radio-sm",
      md: "radio-md",
      lg: "radio-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
  },
});

export interface RadioProps extends React.HTMLAttributes<HTMLInputElement>, VariantProps<typeof radioVariants> {
  label?: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
}

const Radio: React.FC<RadioProps> = ({ variant, size, className, label, value, onValueChange, name, id, ...props }) => {
  return (
    <div className="flex items-center">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        onChange={(e) => onValueChange(e.currentTarget.value)}
        className={cn(radioVariants({ variant, size }), className)}
        {...props}
      />
      {label && (
        <Label htmlFor={id} className="ml-2">
          {label}
        </Label>
      )}
    </div>
  );
};

export { Radio };
