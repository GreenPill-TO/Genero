// OffRampModal.tsx

import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import InputField from "@shared/components/ui/InputField";
import { createClient } from "@shared/lib/supabase/client";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";

// Define the props and form values
interface OffRampProps {
  closeModal: () => void;
  userBalance: string;
}

interface OffRampFormValues {
  preferredDonationAmount: number;
  interac_transfer: string;
  otp?: string; // OTP is optional and only required once sent
}

// Create Supabase client instance
const supabase = createClient();

const OffRampModal = ({ closeModal, userBalance }: OffRampProps) => {
  const {
    control,
    handleSubmit,
    watch,
    reset,
  } = useForm<OffRampFormValues>({
    defaultValues: {
      preferredDonationAmount: 0,
      interac_transfer: "",
      otp: "",
    },
  });

  // Local states for handling loading and OTP
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Retrieve user data (assumed to include TCOIN balance and role)
  const { userData } = useAuth();

  // Watch the TCOIN donation amount and compute estimated CAD
  const donationAmount = watch("preferredDonationAmount") || 0;
  const exchangeRate = 3.3;
  const estimatedCAD = donationAmount * exchangeRate;

  // Example thresholds and balance checks
  const MIN_TCOIN = 10;

  // Simulate sending an OTP via SMS (in production, call your OTP API)
  const sendOTP = async () => {
    console.log("Sending OTP...");
    // Simulate network delay
    return new Promise((resolve) => setTimeout(resolve, 1000));
  };

  // Simulate OTP verification (in production, validate with your OTP service)
  const verifyOTP = async (otp: string) => {
    // For demonstration, assume "123456" is the correct OTP
    return otp === "123456";
  };

  // Main form submission handler
  const onSubmit = async (data: OffRampFormValues) => {
    setErrorMessage("");

    // Validate user TCOIN balance and minimum threshold
    if (donationAmount > userBalance) {
      setErrorMessage("Insufficient TCOIN balance.");
      return;
    }
    if (donationAmount < MIN_TCOIN) {
      setErrorMessage(`Minimum off-ramp amount is ${MIN_TCOIN} TCOIN.`);
      return;
    }

    // If OTP has not been sent yet, send it and exit early
    if (!otpSent) {
      setLoading(true);
      await sendOTP();
      setOtpSent(true);
      setLoading(false);
      return;
    }

    // If OTP is sent but not yet verified, validate the provided OTP
    if (!otpVerified) {
      if (!data.otp) {
        setErrorMessage("Please enter the OTP sent to your phone.");
        return;
      }
      setLoading(true);
      const isValidOTP = await verifyOTP(data.otp);
      if (!isValidOTP) {
        setErrorMessage("Invalid OTP. Please try again.");
        setLoading(false);
        return;
      }
      setOtpVerified(true);
      setLoading(false);
    }

    // OTP is now verified—proceed with processing the off-ramp request
    setLoading(true);

    // Generate unique IDs for the off-ramp request and the transaction record
    const offRampRequestId = uuidv4();
    const transactionId = uuidv4();

    // Determine fee percentage based on user role
    const isStoreOwner = userData?.isStoreOwner || false;
    const feePercentage = isStoreOwner ? 0.02 : 0.05;
    const CAD_offramp_fee = parseFloat((estimatedCAD * feePercentage).toFixed(2));
    const CAD_to_user = parseFloat((estimatedCAD - CAD_offramp_fee).toFixed(2));

    // Insert a record into the off_ramp_requests table (metadata tracking)
    const offRampResponse = await supabase.from("off_ramp_requests").insert([
      {
        off_ramp_request_id: offRampRequestId,
        transaction_id: transactionId,
        user_id: userData?.cubidData?.id,
        total_TCOIN_burned: donationAmount,
        exchange_rate: exchangeRate,
        CAD_offramp_fee,
        CAD_to_user,
        interac_transfer_target: data.interac_transfer,
        admin_notes: null,
        bank_reference_number: null,
        status: "pending",
      },
    ]);

    if (offRampResponse.error) {
      console.error("Error inserting off-ramp request:", offRampResponse.error);
      setErrorMessage("Failed to create off-ramp request. Please try again.");
      setLoading(false);
      return;
    }

    // Simulate blockchain token burn using an RPC function (replace with actual call)
    const burnResponse = await supabase.rpc("burn_tcoin", { tcoin_amount: donationAmount });
    if (burnResponse.error) {
      console.error("Error burning TCOIN:", burnResponse.error);
      setErrorMessage("Token burn failed. Please try again.");
      setLoading(false);
      return;
    }

    // Create a parent transaction record to group bookkeeping entries
    const transactionResponse = await supabase.from("transactions").insert([
      {
        transaction_id: transactionId,
        user_id: userData?.cubidData?.id,
        transaction_type: "off-ramp",
        status: "requested",
        timestamp: new Date().toISOString(),
      },
    ]);

    if (transactionResponse.error) {
      console.error("Error inserting transaction:", transactionResponse.error);
      setErrorMessage("Failed to log transaction. Please try again.");
      setLoading(false);
      return;
    }

    // Insert bookkeeping entries into transactions_detail table
    const debitEntry = {
      transaction_id: transactionId,
      account: "asset-reserve-account",
      type: "debit",
      amount: estimatedCAD,
      description: `Debit asset reserve for ${donationAmount} TCOIN at exchange rate ${exchangeRate}`,
    };

    const creditCustomerEntry = {
      transaction_id: transactionId,
      account: "customer-payables",
      type: "credit",
      amount: CAD_to_user,
      description: "Credit customer payables for off-ramp request",
    };

    const creditFeeEntry = {
      transaction_id: transactionId,
      account: "off-ramp-fees",
      type: "credit",
      amount: CAD_offramp_fee,
      description: "Credit off-ramp fees for off-ramp request",
    };

    const detailsResponse = await supabase.from("transactions_detail").insert([
      debitEntry,
      creditCustomerEntry,
      creditFeeEntry,
    ]);

    if (detailsResponse.error) {
      console.error("Error inserting transaction details:", detailsResponse.error);
      setErrorMessage("Failed to log transaction details. Please try again.");
      setLoading(false);
      return;
    }

    // On success, reset the form and close the modal
    setLoading(false);
    reset();
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="mt-2 p-0">
        <div className="space-y-4">
          <Controller
            name="preferredDonationAmount"
            control={control}
            render={({ field }) => (
              <InputField
                {...field}
                label="Preferred Donation Amount (TCOIN)"
                type="number"
                placeholder="Amount in TCOIN"
                fullWidth
                onChange={(e) => {
                  const value = parseFloat(e.currentTarget.value);
                  field.onChange(isNaN(value) ? 0 : value);
                }}
              />
            )}
          />
          <p>Estimated CAD: ${estimatedCAD.toFixed(2)}</p>
          <Controller
            name="interac_transfer"
            control={control}
            render={({ field }) => (
              <InputField
                {...field}
                fullWidth
                placeholder="Interac eTransfer email or phone"
                type="email"
                label="Interac Destination"
              />
            )}
          />
          {/* OTP field is rendered only after the OTP has been sent and before it is verified */}
          {otpSent && !otpVerified && (
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
          )}
          {errorMessage && (
            <p className="text-sm text-red-500">{errorMessage}</p>
          )}
          <Button className="w-full" disabled={loading} type="submit">
            {loading
              ? "Processing..."
              : otpSent && !otpVerified
                ? "Verify OTP"
                : otpVerified
                  ? "Convert and Transfer"
                  : "Send OTP"}
          </Button>
        </div>
      </div>
    </form>
  );
};

export { OffRampModal };