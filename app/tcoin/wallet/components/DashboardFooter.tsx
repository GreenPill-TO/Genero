import React from "react";
import { Home, QrCode, Send, Users, Settings, History } from "lucide-react";
import { cn } from "@shared/utils/classnames";

interface FooterProps {
  active: string;
  onChange: (key: string) => void;
}

const mobileItems = [
  { key: "home", label: "Home", icon: Home },
  { key: "receive", label: "Receive", icon: QrCode },
  { key: "send", label: "Send", icon: Send },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "more", label: "More", icon: Settings },
];

const desktopItems = [
  { key: "home", label: "Home", icon: Home },
  { key: "receive", label: "Receive", icon: QrCode },
  { key: "send", label: "Send", icon: Send },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "history", label: "History", icon: History },
  { key: "more", label: "More", icon: Settings },
];

export function DashboardFooter({ active, onChange }: FooterProps) {
  const handleSelect = (key: string) => {
    onChange(key);
    window.scrollTo({ top: 0 });
    document.dispatchEvent(new Event("hide-header"));
  };

  const renderItem = ({
    key,
    label,
    Icon,
    testId,
    compact = false,
  }: {
    key: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    testId: string;
    compact?: boolean;
  }) => {
    const isActive = active === key;

    return (
      <button
        data-testid={testId}
        onClick={() => {
          handleSelect(key);
        }}
        className={cn(
          "w-full flex flex-col items-center justify-center rounded-2xl font-sans transition duration-200",
          compact ? "gap-2 px-2 py-3 text-xs xl:text-[13px]" : "gap-1 px-1 py-2 text-[11px]",
          !compact && isActive ? "-mt-4" : "",
          isActive
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-2xl transition duration-200",
            isActive
              ? compact
                ? "bg-primary p-3.5 shadow-[0_18px_34px_rgba(8,145,178,0.35)]"
                : "bg-primary p-3 shadow-[0_16px_30px_rgba(8,145,178,0.35)]"
              : compact
                ? "p-2.5"
                : "p-2.5"
          )}
        >
          <Icon className={cn(compact ? "h-[22px] w-[22px]" : "h-5 w-5", isActive && "text-white")} />
        </span>
        <span>{label}</span>
      </button>
    );
  };

  const more = desktopItems.find((item) => item.key === "more")!;
  const middle = desktopItems.filter((item) => item.key !== "more");

  return (
    <>
      <nav className="fixed bottom-4 left-4 right-4 z-40 font-sans lg:hidden">
        <ul className="grid grid-cols-5 rounded-[24px] border border-white/10 bg-background/85 p-2 shadow-[0_24px_40px_rgba(15,23,42,0.2)] backdrop-blur-xl">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key} className="flex justify-center">
                {renderItem({
                  key: item.key,
                  label: item.label,
                  Icon,
                  testId: `footer-${item.key}`,
                })}
              </li>
            );
          })}
        </ul>
      </nav>

      <nav data-testid="sidebar-shell" className="fixed left-4 top-24 bottom-6 z-30 hidden w-[112px] font-sans lg:block xl:w-[124px]">
        <div className="flex h-full flex-col items-center rounded-[32px] border border-white/10 bg-background/75 py-5 shadow-[0_24px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex flex-1 w-full flex-col items-center justify-center gap-4 px-3">
            {middle.map((item) => (
              <div key={item.key} className="w-full">
                {renderItem({
                  key: item.key,
                  label: item.label,
                  Icon: item.icon,
                  testId: `sidebar-${item.key}`,
                  compact: true,
                })}
              </div>
            ))}
          </div>

          <div className="w-full px-3">
            {renderItem({
              key: more.key,
              label: more.label,
              Icon: more.icon,
              testId: `sidebar-${more.key}`,
              compact: true,
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
