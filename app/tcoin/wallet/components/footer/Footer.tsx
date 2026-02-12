import React from "react";
import { cn } from "@shared/utils/classnames";
import Link from "next/link";

export function Footer() {
  return (
    <footer className={cn("py-6 w-full", "bg-background", "text-foreground")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center [@media(max-width:767px)_and_(orientation:portrait)]:flex-col-reverse [@media(max-width:767px)_and_(orientation:portrait)]:items-stretch [@media(max-width:767px)_and_(orientation:portrait)]:gap-3">
          <div className="[@media(max-width:767px)_and_(orientation:portrait)]:text-left">
            <h4 className="text-lg font-bold">TCOIN.ME</h4>
            <h5>&copy; 2026 Toronto Coin. All rights reserved.</h5>
          </div>
          <div className="space-x-4 text-base [@media(max-width:767px)_and_(orientation:portrait)]:flex [@media(max-width:767px)_and_(orientation:portrait)]:flex-col [@media(max-width:767px)_and_(orientation:portrait)]:space-x-0 [@media(max-width:767px)_and_(orientation:portrait)]:space-y-1 [@media(max-width:767px)_and_(orientation:portrait)]:text-right">
            <Link href="/resources">Resources</Link>
            <Link href="/ecosystem">Ecosystem</Link>
            <Link href="https://github.com/GreenPill-TO/TorontoCoin">Github</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
