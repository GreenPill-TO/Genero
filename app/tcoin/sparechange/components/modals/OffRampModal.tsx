// OffRampModal.tsx
// @ts-nocheck
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import InputField from "@shared/components/ui/InputField";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { createClient } from "@shared/lib/supabase/client";
import { off_ramp_req } from "@shared/utils/insertNotification";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
// Import the react-phone-input-2 library and its stylesheet
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

interface OffRampProps {
  closeModal: () => void;
  userBalance: number;
}

interface OffRampFormValues {
  preferredDonationAmount: number;
  phone_number: string;
  interac_email: string;
  otp?: string;
}

const supabase = createClient();

const OffRampModal = ({ closeModal, userBalance }: OffRampProps) => {
  const { control, handleSubmit, watch, reset } = useForm<OffRampFormValues>({
    defaultValues: {
      preferredDonationAmount: 0,
      phone_number: "",
      interac_email: "",
      otp: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { userData } = useAuth();
  const { burnMoney, senderWallet } = useSendMoney({ senderId: userData?.cubidData?.id });

  const donationAmount = watch("preferredDonationAmount") || 0;
  const exchangeRate = 3.3;
  const estimatedCAD = donationAmount * exchangeRate;
  const MIN_TCOIN = 10;

  // Function to send the OTP via your Next.js API route
  const sendOTP = async () => {
    const phone = watch("phone_number");
    if (!phone) {
      setErrorMessage("Please enter your phone number.");
      return;
    }
    // Optionally, you could further validate the phone number here.
    try {
      setLoading(true);
      const response = await fetch("/api/send_otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+${phone}` }), // phone number in international format
      });
      const result = await response.json();
      if (result.success) {
        setOtpSent(true);
        setErrorMessage("");
      } else {
        setErrorMessage(result.message || "Failed to send OTP. Try again.");
      }
    } catch (error) {
      setErrorMessage("Error sending OTP.");
    }
    setLoading(false);
  };

  // Function to verify the OTP via your Next.js API route
  const verifyOTP = async () => {
    const phone = watch("phone_number");
    const otp = watch("otp");
    if (!phone || !otp) {
      setErrorMessage("Please provide both phone number and OTP.");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch("/api/verify_otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+${phone}`, otp }),
      });
      const result = await response.json();
      if (result.success) {
        setOtpVerified(true);
        setErrorMessage("");
      } else {
        setErrorMessage(result.message || "Invalid OTP. Try again.");
      }
    } catch (error) {
      setErrorMessage("Error verifying OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Final submission: off-ramp conversion and transfer
  const onSubmit = async (data: OffRampFormValues) => {
    setErrorMessage("");

    // Validate donation amount
    if (donationAmount > userBalance) {
      setErrorMessage("Insufficient TCOIN balance.");
      return;
    }
    if (donationAmount < MIN_TCOIN) {
      setErrorMessage(`Minimum off-ramp amount is ${MIN_TCOIN} TCOIN.`);
      return;
    }
    if (!otpVerified) {
      setErrorMessage("OTP must be verified before proceeding.");
      return;
    }
    if (!data.interac_email) {
      setErrorMessage("Please enter your Interac eTransfer email.");
      return;
    }

    setLoading(true);

    // Generate unique IDs for off-ramp request and transaction
    const offRampRequestId = uuidv4();
    const transactionId = uuidv4();

    const isStoreOwner = userData?.isStoreOwner || false;
    const feePercentage = isStoreOwner ? 0.02 : 0.05;
    const CAD_offramp_fee = parseFloat((estimatedCAD * feePercentage).toFixed(2));
    const CAD_to_user = parseFloat((estimatedCAD - CAD_offramp_fee).toFixed(2));

    // Optional: send a notification or log the off-ramp request
    off_ramp_req({
      p_current_token_balance: userBalance,
      p_etransfer_target: data.interac_email,
      p_is_store: true,
      p_tokens_burned: (estimatedCAD / 3.3).toFixed(2),
      p_user_id: userData?.cubidData?.id,
      p_wallet_account: senderWallet,
      p_exchange_rate: 3.3,
    });

    if (offRampResponse.error) {
      setErrorMessage("Failed to create off-ramp request.");
      setLoading(false);
      return;
    }
    // Burn the tokens from the user's balance
    await burnMoney(donationAmount);

    setLoading(false);
    reset();
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mt-2 p-0">
        <div className="space-y-4">
          {/* Donation Amount Input */}
          <Controller
            name="preferredDonationAmount"
            control={control}
            render={({ field }) => (
              <InputField
                {...field}
                label="Preferred Donation Amount (TCOIN)"
                type="number"
                fullWidth
                onChange={(e) =>
                  field.onChange(parseFloat(e.currentTarget.value) || 0)
                }
              />
            )}
          />
          <p>Estimated CAD: ${estimatedCAD.toFixed(2)}</p>

          {/* Phone Number Input using react-phone-input-2 */}
          <Controller
            name="phone_number"
            control={control}
            render={({ field }) => (
              <PhoneInput
                country={'ca'}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                className="!text-black"

              />
            )}
          />

          {/* Send OTP Button (visible if OTP not yet sent) */}
          {!otpSent && (
            <Button
              className="w-full"
              disabled={loading || !watch("phone_number")}
              type="button"
              onClick={sendOTP}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>
          )}

          {/* OTP Input & Verify Button (visible if OTP sent but not verified) */}
          {otpSent && !otpVerified && (
            <>
              <Controller
                name="otp"
                control={control}
                render={({ field }) => (
                  <InputField
                    {...field}
                    fullWidth
                    placeholder="Enter OTP"
                    type="text"
                    label="OTP Verification"
                  />
                )}
              />
              <Button
                className="w-full"
                disabled={loading || !watch("otp")}
                type="button"
                onClick={verifyOTP}
              >
                {loading ? "Verifying OTP..." : "Verify OTP"}
              </Button>
            </>
          )}

          {/* Interac eTransfer Email Input */}
          <Controller
            name="interac_email"
            control={control}
            render={({ field }) => (
              <InputField
                {...field}
                fullWidth
                placeholder="Interac eTransfer Email"
                type="email"
                label="Interac Destination Email"
              />
            )}
          />

          {errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}

          {/* Final submission button for conversion and transfer */}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Processing..." : "Convert and Transfer"}
          </Button>
        </div>
      </div>
    </form>
  );
};

export { OffRampModal };