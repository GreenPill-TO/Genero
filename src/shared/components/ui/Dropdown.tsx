import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/utils/classnames";
import { cva, VariantProps } from "class-variance-authority";
import React, { useEffect, useRef, useState } from "react";

interface MenuItem {
  title: string;
  action: () => void;
}

const dropdownVariants = cva("dropdown", {
  variants: {
    variant: {
      default: "dropdown-end",
      end: "input-end",
      top: "input-top",
      bottom: "input-bottom",
      left: "input-left",
      right: "input-right",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface DropdownProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof dropdownVariants> {
  items: MenuItem[];
  hoverToOpen?: boolean;
  triggerElTitle: string;
}

const Dropdown: React.FC<DropdownProps> = ({ items, variant, className, triggerElTitle, hoverToOpen = false }) => {
  const [isOpen, setIsOpen] = useState(false); // State to control dropdown visibility
  const dropdownRef = useRef<HTMLDivElement | null>(null); // Ref for the dropdown container

  // Handle click outside to close dropdown
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    // Add event listener for clicks
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Clean up event listener on unmount
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className={cn(dropdownVariants({ variant }), className, hoverToOpen ? "dropdown-hover" : "")}>
      <Button
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)} // Toggle dropdown visibility
      >
        {triggerElTitle}
      </Button>
      {isOpen && ( // Render dropdown items conditionally based on state
        <ul tabIndex={0} className="menu dropdown-content bg-secondary rounded font-semibold z-[1] mt-1 w-52 p-2 shadow">
          {items.map((item, index) => (
            <li key={index}>
              <a
                onClick={() => {
                  item.action(); // Execute the item action
                  setIsOpen(false); // Close dropdown after action
                }}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export { Dropdown };
