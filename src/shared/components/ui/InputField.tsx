import { cn } from "@/lib/classnames";
import React from "react";
import { Input } from "./Input";
import { Label } from "./Label";

interface InputFieldProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  disabled = false,
  fullWidth = false,
}) => {
  return (
    <div className={cn("text-field mb-4")}>
      <Label htmlFor={name} className="mr-2">
        {label}
      </Label>
      <Input
        className={fullWidth ? "w-full" : ""}
        variant="bordered"
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
};

export default InputField;
