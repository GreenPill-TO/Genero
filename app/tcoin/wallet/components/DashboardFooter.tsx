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
  }) => (
    <button
      data-testid={testId}
      onClick={() => {
        handleSelect(key);
      }}
      className={cn(
        "w-full flex flex-col items-center justify-center text-xs gap-1",
        !compact && key === "send" ? "-mt-4" : "",
        active === key ? "text-primary" : "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center",
          key === "send" ? "p-3 rounded-full bg-primary" : compact ? "p-1.5" : "p-2"
        )}
      >
        <Icon className={cn("h-5 w-5", key === "send" && "text-white")} />
      </span>
      <span>{label}</span>
    </button>
  );

  const more = desktopItems.find((item) => item.key === "more")!;
  const middle = desktopItems.filter((item) => item.key !== "more");

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-background lg:hidden">
        <ul className="grid grid-cols-5">
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

      <nav className="fixed left-0 top-16 bottom-0 hidden w-24 border-r bg-background lg:block">
        <div className="flex h-full flex-col items-center py-4">
          <div className="flex flex-1 w-full flex-col items-center justify-center gap-6 px-2">
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

          <div className="w-full px-2">
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
