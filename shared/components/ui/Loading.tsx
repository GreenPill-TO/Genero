import * as React from "react";

import { cn } from "@shared/utils/classnames";
import { cva, type VariantProps } from "class-variance-authority";

const loadingVariants = cva("loading", {
  variants: {
    variant: {
      spinner: "loading-spinner",
      dots: "loading-dots",
      ring: "loading-ring",
      ball: "loading-ball",
      bars: "loading-bars",
      infinity: "loading-infinity",
    },
  },
  defaultVariants: {
    variant: "spinner",
  },
});

export interface LoadingProps extends VariantProps<typeof loadingVariants> {
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({ variant, className, ...props }) => {
  return <span className={cn(loadingVariants({ variant }), className)} {...props} />;
};

export { Loading };
