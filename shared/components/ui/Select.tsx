import * as React from "react";

import { cn } from "@shared/utils/classnames";
import { cva, type VariantProps } from "class-variance-authority";

const selectVariants = cva("select bg-background", {
  variants: {
    variant: {
      default: "",
      bordered: "select-bordered",
      ghost: "select-ghost",
      primary: "select-primary",
      secondary: "select-secondary",
      accent: "select-accent",
      success: "select-success",
      warning: "select-warning",
      info: "select-info",
      error: "select-error",
    },
    elSize: {
      xs: "select-xs",
      sm: "select-sm",
      md: "select-md",
      lg: "select-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    elSize: "sm",
  },
});

export interface SelectProps extends React.HTMLAttributes<HTMLSelectElement>, VariantProps<typeof selectVariants> {
  label?: string;
  name: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { label: string; value: string }[];
}

const Select: React.FC<SelectProps> = ({ variant, elSize, className, label, name, value, onValueChange, options, ...props }) => {
  return (
    <div>
      {label && (
        <div className="label">
          <span className="label-text text-foreground">{label}</span>
        </div>
      )}
      <select
        name={name}
        className={cn(selectVariants({ variant, elSize }), className)}
        {...props}
        value={value}
        onChange={(e) => {
          onValueChange(e.currentTarget.value);
        }}
      >
        {options.map((option) => {
          return <option value={option.value} key={option.value} label={option.label} />;
        })}
      </select>
    </div>
  );
};

export { Select };
