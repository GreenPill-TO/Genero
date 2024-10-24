import * as React from "react";

import { cn } from "@shared/utils/classnames";
import { cva, type VariantProps } from "class-variance-authority";

const switchVariants = cva("toggle", {
  variants: {
    variant: {
      default: "",
      primary: "toggle-primary",
      secondary: "toggle-secondary",
      accent: "toggle-accent",
      success: "toggle-success",
      warning: "toggle-warning",
      info: "toggle-info",
      error: "toggle-error",
    },
    size: {
      xs: "toggle-xs",
      sm: "toggle-sm",
      md: "toggle-md",
      lg: "toggle-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "sm",
  },
});

export interface SwitchProps extends React.HTMLAttributes<HTMLInputElement>, VariantProps<typeof switchVariants> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const Switch: React.FC<SwitchProps> = ({ variant, size, className, checked, onCheckedChange, ...props }) => {
  return (
    <input
      type="checkbox"
      className={cn(switchVariants({ variant, size }), className)}
      {...props}
      checked={checked}
      onChange={(e) => onCheckedChange(e.currentTarget.checked)}
    />
  );
};

export { Switch };
