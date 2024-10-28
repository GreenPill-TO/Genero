import { cn } from "@shared/utils/classnames";

export default function AppLogo() {
  const mainClass = cn("text-base font-medium", "mr-8 p-px rounded-lg");

  return (
    <div className={mainClass}>
      <div className="px-12 py-1">TCOIN.ME</div>
    </div>
  );
}
