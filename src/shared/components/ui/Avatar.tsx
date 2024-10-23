import { cn } from "@/lib/classnames";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const imageVariants = cva("", {
  variants: {
    variant: {
      default: "",
    },
    size: {
      default: "h-10 w-10",
      sm: "h-9",
      lg: "h-20 w-20",
      icon: "h-10 w-10",
    },
    radius: {
      default: "rounded-full",
      md: "rounded-md",
      sm: "rouned-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
    radius: "default",
  },
});

export interface AvatarProps extends React.ImgHTMLAttributes<HTMLImageElement>, VariantProps<typeof imageVariants> {}

const Avatar: React.FC<AvatarProps> = ({ className, variant, size, radius, ...props }) => (
  <div className={"avatar"}>
    <div className={cn(imageVariants({ variant, size, radius, className }))}>
      <img {...props} />
    </div>
  </div>
);

export { Avatar };
