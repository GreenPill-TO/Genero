"use client";

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
        "px-3 font-semibold my-4 mr-2 lg:m-0 no-underline",
        { "opacity-80": pathname !== link },
        optionalClass
      )}
      href={link}
    >
      {title}
    </Link>
  );
}
