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
      <ul className="flex justify-between px-4 py-2">
        {items.map((item) => (
          <li key={item.key} className="flex-1">
            <button
              data-testid={`footer-${item.key}`}
              onClick={() => onChange(item.key)}
              className={cn(
                "flex flex-col items-center text-xs gap-1",
                item.key === "send" ? "-mt-4" : "",
                active === item.key ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center",
                  item.key === "send"
                    ? "p-3 rounded-full bg-primary text-white"
                    : "p-2"
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
