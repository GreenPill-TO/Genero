import { cn } from "@shared/utils/classnames";
import Link from "next/link";

export function Footer() {
  return (
    <footer className={cn("py-6 w-full", "bg-white", "text-black")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-lg font-bold">TCOIN.ME</h4>
            <h5>&copy; {new Date().getFullYear()} Toronto Coin. All rights reserved.</h5>
          </div>
          <div className="space-x-4 text-sm">
            <Link href="/whitepaper">Whitepaper</Link>
            <Link href="https://github.com">Github</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
