// @ts-nocheck
export * from "./OTPForm";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { Loading } from "@shared/components/ui/Loading";
import { Select } from "@shared/components/ui/Select";
import { countryCodes, formatPhoneNumber } from "@shared/utils/phone";
import { ChangeEvent, FormEvent } from "react";

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
          <div className="text-left">
            <p className="text-lg md:mt-0 mt-6 font-semibold">
              Enter verification code received on {contact}
            </p>
            <p className="text-slate-500 mt-2 text-sm">
              Didn't receive the code? Check your spam folder
            </p>
            <div className="mt-4">
              <Button type="button" onClick={onResend} disabled={!canResend}>
                {canResend ? "Resend Code" : "Please wait..."}
              </Button>
            </div>
          </div>
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
            <Input
              type="text"
              value={passcode}
              placeholder="Ex- 123456"
              onChange={(e) => setPasscode(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Display error only for phone authMethod */}
      {errorMessage && <div className="text-rose-500">{errorMessage}</div>}

      <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
        {isLoading && <Loading />}
        {isOtpSent ? "Verify" : "Get Verification Code"}
      </Button>
    </form>
  );
}

export default OTPForm;
