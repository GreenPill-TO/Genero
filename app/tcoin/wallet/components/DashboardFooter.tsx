import React from "react";
import { Home, QrCode, Send, Users, Settings } from "lucide-react";
import { cn } from "@shared/utils/classnames";

interface FooterProps {
  active: string;
  onChange: (key: string) => void;
}

const items = [
  { key: "home", label: "Home", icon: Home },
  { key: "receive", label: "Receive", icon: QrCode },
  { key: "send", label: "Send", icon: Send },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "more", label: "More", icon: Settings },
];

export function DashboardFooter({ active, onChange }: FooterProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-background">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex justify-center">
              <button
                data-testid={`footer-${item.key}`}
                onClick={() => {
                  onChange(item.key);
                  window.scrollTo({ top: 0 });
                  document.dispatchEvent(new Event("hide-header"));
                }}
                className={cn(
                  "w-full flex flex-col items-center justify-center text-xs gap-1",
                  item.key === "send" ? "-mt-4" : "",
                  active === item.key ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center",
                    item.key === "send" ? "p-3 rounded-full bg-primary" : "p-2"
                  )}
                >
                  <Icon className={cn("h-5 w-5", item.key === "send" && "text-white")} />
                </span>
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
