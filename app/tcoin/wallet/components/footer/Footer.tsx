import { cn } from "@shared/utils/classnames";

export function Footer() {
  return (
    <footer className={cn("py-6 w-full", "bg-background", "shadow-top")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-lg font-bold">TCOIN.ME</h4>
            <h5>&copy; {new Date().getFullYear()} Toronto Coin. All rights reserved.</h5>
          </div>
        </div>
      </div>
    </footer>
  );
}
