"use client";

import * as React from "react";

import { cn } from "@/lib/classnames";
import { cva, type VariantProps } from "class-variance-authority";

const tabsVariants = cva("tabs", {
  variants: {
    variant: {
      default: "tabs-bordered",
      bordered: "tabs-bordered",
      lifted: "tabs-lifted",
      boxed: "tabs-boxed",
    },
    size: {
      default: "",
      sm: "tabs-sm",
      xs: "tabs-xs",
      md: "tabs-md",
      lg: "tabs-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof tabsVariants> {}

const Tabs: React.FC<TabsProps> = ({ variant, size, className, ...props }) => {
  return <div role="tablist" className={cn(tabsVariants({ variant, size }), className)} {...props} />;
};

export interface TabTriggerProps extends React.HTMLAttributes<HTMLInputElement> {
  name?: string;
  ariaLabel?: string;
}

const TabTrigger: React.FC<TabTriggerProps> = ({ className, name, ariaLabel, ...props }) => {
  return <input type="radio" role="tab" className={cn("tab text-primary", className)} {...props} name={name} aria-label={ariaLabel} />;
};

const TabContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div role="tabpanel" className={cn("tab-content p-10", className)} {...props} />;
};

export { TabContent, Tabs, TabTrigger };
