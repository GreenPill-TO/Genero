// @ts-nocheck
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Loading } from "@shared/components/ui/Loading";
import { Select } from "@shared/components/ui/Select";
import { formatPhoneNumber } from "@shared/utils/phone";
import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type OTPFormProps = {
  authMethod: "phone" | "email";
  countryCode: string;
  contact: string;
  passcode: string;
  setCountryCode: (value: string) => void;
  setContact: (value: string) => void;
  setPasscode: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onResend: () => void; // New callback for resending OTP
  canResend: boolean;   // Flag to control when resend is allowed
  isOtpSent: boolean;
  isLoading?: boolean;
  errorMessage: string | null;
  handleAuthMethodChange: (method: "phone" | "email") => void;
};

function OTPForm({
  authMethod,
  countryCode,
  contact,
  passcode,
  setCountryCode,
  setContact,
  setPasscode,
  onSubmit,
  onResend,
  canResend,
  isOtpSent,
  errorMessage,
  handleAuthMethodChange,
  isLoading = false,
}: OTPFormProps) {
  const handleContactChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setContact(authMethod === "phone" ? formatPhoneNumber(value, countryCode) : value);
  };

  const [digits, setDigits] = useState(Array(6).fill(""));
  const inputsRef = useRef([]);

  useEffect(() => {
    if (isOtpSent) {
      setDigits(Array(6).fill(""));
      setPasscode("");
      inputsRef.current[0]?.focus();
    }
  }, [isOtpSent, setPasscode]);

  useEffect(() => {
    if (isOtpSent && digits.every((d) => d !== "")) {
      onSubmit(new Event("submit") as any);
    }
  }, [isOtpSent, digits, onSubmit]);

  const handleDigitChange = (value: string, idx: number) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[idx] = value;
    setDigits(newDigits);
    setPasscode(newDigits.join(""));
    if (value && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      const newDigits = [...digits];
      newDigits[idx - 1] = "";
      setDigits(newDigits);
      setPasscode(newDigits.join(""));
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste) {
      e.preventDefault();
      const newDigits = Array(6).fill("");
      for (let i = 0; i < paste.length; i++) newDigits[i] = paste[i];
      setDigits(newDigits);
      setPasscode(newDigits.join(""));
      inputsRef.current[Math.min(paste.length, 5)]?.focus();
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-4">
        {!isOtpSent && (
          <>
            <p className="text-center md:mt-0 mt-6 text-xl mb-4 font-semibold">Sign In or Sign Up</p>
            <div className="flex mb-4 items-center">
              <Select
                label="Sign in with:"
                variant="bordered"
                elSize="md"
                name="authMethod"
                value={authMethod}
                onValueChange={(v) => handleAuthMethodChange(v as "phone" | "email")}
                options={[
                  { label: "Email", value: "email" },
                ]}
              />
            </div>
          </>
        )}

        {isOtpSent && (
          <p className="text-lg md:mt-0 mt-6 font-semibold text-left">
            Enter verification code received on {contact}
          </p>
        )}

        {/* Updated email input with pattern validation */}
        {!isOtpSent && authMethod === "email" && (
          <div className="form-control w-full mt-8">
            <Input
              elSize="md"
              variant="bordered"
              type="email"
              placeholder="Enter your email"
              value={contact}
              onChange={handleContactChange}
              pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
              title="Please enter a valid email address"
              required
            />
          </div>
        )}

        {isOtpSent && (
          <div className="form-control w-full mt-8">
            <label className="label">
              <span className="label-text text-xs">Verification Code</span>
            </label>
            <div className="flex gap-2">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputsRef.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-10 h-10 text-center border border-gray-500 rounded-md bg-white"
                  value={digit}
                  onChange={(e) => handleDigitChange(e.target.value, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={handlePaste}
                />
              ))}
            </div>
            <p className="text-slate-500 mt-2 text-sm">
              Didn't receive the code? Check your spam folder
              <button
                type="button"
                onClick={onResend}
                disabled={!canResend}
                className="ml-1 underline text-blue-600 disabled:text-gray-400"
              >
                Resend Code
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Display error only for phone authMethod */}
      {errorMessage && <div className="text-rose-500">{errorMessage}</div>}

      {!isOtpSent && (
        <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
          {isLoading && <Loading />}
          Get Verification Code
        </Button>
      )}
    </form>
  );
}

export default OTPForm;
