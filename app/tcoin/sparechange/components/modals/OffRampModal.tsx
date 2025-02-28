// OffRampModal.tsx
// @ts-nocheck
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import InputField from "@shared/components/ui/InputField";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { createClient } from "@shared/lib/supabase/client";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";

// Import your SMS OTP service (Twilio, Firebase, etc.)

interface OffRampProps {
  closeModal: () => void;
  userBalance: string;
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
  const { burnMoney } = useSendMoney({ senderId: userData?.cubidData?.id })

  const donationAmount = watch("preferredDonationAmount") || 0;
  const exchangeRate = 3.3;
  const estimatedCAD = donationAmount * exchangeRate;
  const MIN_TCOIN = 10;

  const sendOTP = async (phone: string) => {
    try {
      setLoading(true);
      // const response = await sendSMSOTP(phone);
      // if (response.success) {
      setOtpSent(true);
      // } else {
      //   setErrorMessage("Failed to send OTP. Try again.");
      // }
    } catch (error) {
      setErrorMessage("Error sending OTP.");
    }
    setLoading(false);
  };

  const verifyOTP = async (otp: string) => {
    try {
      setLoading(true);
      // const isValid = await verifySMSOTP(otp);
      // if (!isValid) {
      //   setErrorMessage("Invalid OTP. Try again.");
      //   setLoading(false);
      //   return false;
      // }
      setOtpVerified(true);
      return true;
    } catch (error) {
      setErrorMessage("Error verifying OTP.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: OffRampFormValues) => {
    setErrorMessage("");

    if (donationAmount > userBalance) {
      setErrorMessage("Insufficient TCOIN balance.");
      return;
    }
    if (donationAmount < MIN_TCOIN) {
      setErrorMessage(`Minimum off-ramp amount is ${MIN_TCOIN} TCOIN.`);
      return;
    }

    if (!otpSent) {
      if (!data.phone_number) {
        setErrorMessage("Please enter your phone number.");
        return;
      }
      await sendOTP(data.phone_number);
      return;
    }

    if (!otpVerified) {
      if (!data.otp) {
        setErrorMessage("Please enter the OTP sent to your phone.");
        return;
      }
      const valid = await verifyOTP(data.otp);
      if (!valid) return;
    }

    if (!data.interac_email) {
      setErrorMessage("Please enter your Interac eTransfer email.");
      return;
    }

    setLoading(true);

    const offRampRequestId = uuidv4();
    const transactionId = uuidv4();

    const isStoreOwner = userData?.isStoreOwner || false;
    const feePercentage = isStoreOwner ? 0.02 : 0.05;
    const CAD_offramp_fee = parseFloat((estimatedCAD * feePercentage).toFixed(2));
    const CAD_to_user = parseFloat((estimatedCAD - CAD_offramp_fee).toFixed(2));

    const offRampResponse = await supabase.from("off_ramp_req").insert([
      {
        cad: CAD_to_user,
        user_id: userData?.cubidData?.id,
        interac_transfer: data.interac_email,
        tokens_burned: donationAmount,
        exchange_rate: exchangeRate,
        cad_fee: CAD_offramp_fee
      },
    ]).select("*")

    if (offRampResponse.error) {
      setErrorMessage("Failed to create off-ramp request.");
      setLoading(false);
      return;
    }

    const { data: acc_transactions } = await supabase.from("act_transactions").insert({
      transaction_category: "transfer",
      created_by: userData?.cubidData.id,
      offramp_request_id: offRampResponse?.data?.[0]?.id
    }).select("*")

    await burnMoney(donationAmount)

    setLoading(false);
    reset();
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mt-2 p-0">
        <div className="space-y-4">
          <Controller name="preferredDonationAmount" control={control} render={({ field }) => (
            <InputField {...field} label="Preferred Donation Amount (TCOIN)" type="number" fullWidth onChange={(e) => field.onChange(parseFloat(e.currentTarget.value) || 0)} />
          )} />
          <p>Estimated CAD: ${estimatedCAD.toFixed(2)}</p>

          {/* Phone Number Input (for OTP) */}
          <Controller name="phone_number" control={control} render={({ field }) => (
            <InputField {...field} fullWidth placeholder="Phone Number" type="tel" label="Phone Number (for OTP)" />
          )} />

          {/* OTP Input (only after sending OTP) */}
          {otpSent && !otpVerified && (
            <Controller name="otp" control={control} render={({ field }) => (
              <InputField {...field} fullWidth placeholder="Enter OTP" type="text" label="OTP Verification" />
            )} />
          )}

          {/* Interac eTransfer Email Input */}
          <Controller name="interac_email" control={control} render={({ field }) => (
            <InputField {...field} fullWidth placeholder="Interac eTransfer Email" type="email" label="Interac Destination Email" />
          )} />

          {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Processing..." : otpSent && !otpVerified ? "Verify OTP" : otpVerified ? "Convert and Transfer" : "Send OTP"}
          </Button>
        </div>
      </div>
    </form>
  );
};

export { OffRampModal };
