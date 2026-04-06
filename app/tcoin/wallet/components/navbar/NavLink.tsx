"use client";

import React from "react";
import { cn } from "@shared/utils/classnames";
import Link from "next/link";
import { usePathname } from "next/navigation";

type TNavLinkProps = {
  link: string;
  title: string;
  optionalClass?: string;
};
export default function NavLink({ link, title, optionalClass = "" }: TNavLinkProps) {
  const pathname = usePathname();

  return (
    <Link
      className={cn(
        "my-4 mr-2 px-3 font-sans font-semibold no-underline lg:m-0",
        { "opacity-80": pathname !== link },
        optionalClass
      )}
      href={link}
    >
      {title}
    </Link>
  );
}
