import React from "react";
import { IconType } from "react-icons"; // Assuming you use react-icons

interface IconListProps {
  items: { icon: IconType; text: string }[];
}

const IconList: React.FC<IconListProps> = ({ items }) => {
  return (
    <ul className="icon-list space-y-4">
      {items.map((item, index) => (
        <li key={index} className="flex items-center">
          <item.icon className={`mr-2 `} size={24} />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
};

export default IconList;
