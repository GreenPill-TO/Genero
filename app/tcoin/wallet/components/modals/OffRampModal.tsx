// OffRampModal.tsx
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import InputField from "@shared/components/ui/InputField";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { createClient } from "@shared/lib/supabase/client";
import { off_ramp_req } from "@shared/utils/insertNotification";
import { useForm, Controller } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";

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


const OffRampModal = ({ closeModal, userBalance }: OffRampProps) => {
  const { control, handleSubmit, watch, setValue, reset } = useForm<OffRampFormValues>({
    defaultValues: {
      preferredDonationAmount: 0,
      phone_number: "",
      interac_email: "",
      otp: "",
    },
  });

  const [phoneCubidSDK, setPhoneCubidSDK] = useState("");
  const [cubidSdk, setCubidSDK] = useState(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { userData } = useAuth();
  const { burnMoney, senderWallet } = useSendMoney({ senderId: userData?.cubidData?.id });
  const { exchangeRate } = useControlVariables();

  const donationAmount = watch("preferredDonationAmount");
  const estimatedCAD = donationAmount * exchangeRate;
  const MIN_TCOIN = 10;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal]);

  useEffect(() => {
    const loadSDK = async () => {
      const { CubidSDK } = await import("cubid-sdk");
      const cubid_sdk = new CubidSDK(57, "14475a54-5bbe-4f3f-81c7-ff4403ad0830");
      const cubid_stamps = await cubid_sdk.fetchStamps({ user_id: userData?.user?.cubid_id });

      const phoneStamp = cubid_stamps.all_stamps.find((item) => item.stamptype_string === "phone")?.uniquevalue;

      if (phoneStamp) {
        setPhoneCubidSDK(phoneStamp);
        setValue("phone_number", phoneStamp);
      }

      setCubidSDK(cubid_sdk);
    };
    loadSDK();
  }, []);

  const sendOTP = async () => {
    const phone = phoneCubidSDK || watch("phone_number");

    if (!phone) {
      setErrorMessage("Please enter a valid phone number.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/send_otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+${phone}` }),
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

  const verifyOTP = async () => {
    const phone = phoneCubidSDK || watch("phone_number");
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

  const onSubmit = async (data: OffRampFormValues) => {
    if (!otpVerified) {
      setErrorMessage("OTP must be verified before proceeding.");
      return;
    }
    if (donationAmount > userBalance) {
      setErrorMessage("Insufficient TCOIN balance.");
      return;
    }
    if (donationAmount < MIN_TCOIN) {
      setErrorMessage(`Minimum off-ramp amount is ${MIN_TCOIN} TCOIN.`);
      return;
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

    off_ramp_req({
      p_current_token_balance: userBalance,
      p_etransfer_target: data.interac_email,
      p_is_store: true,
      p_tokens_burned: (estimatedCAD / exchangeRate).toFixed(2),
      p_user_id: userData?.cubidData?.id,
      p_wallet_account: senderWallet,
      p_exchange_rate: exchangeRate,
    });

    await burnMoney(donationAmount);

    const supabase = createClient();
    const { data: off_ramp_req_data, error } = await supabase
      .from("off_ramp_req")
      .select("*")
      .match({ user_id: userData?.cubidData?.id })
      .order("id", { ascending: false })
      .limit(1);

    await supabase
      .rpc('accounting_after_offramp_burn', {
        p_offramp_req_id: off_ramp_req_data?.[0]?.id
      })

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
              <InputField {...field} label="TCOIN amount to redeem (TCOIN)" type="number" fullWidth />
            )}
          />
          <p>Estimated CAD: ${estimatedCAD.toFixed(2)}</p>
          {donationAmount > userBalance && (
            <p className="text-sm text-red-500">
              Warning: The entered TCOIN amount exceeds your available balance of {userBalance}.
            </p>
          )}

          <Controller
            name="phone_number"
            control={control}
            render={({ field }) => (
              <PhoneInput
                country={"us"}
                className="!text-black"
                value={phoneCubidSDK || field.value}
                onChange={(value) => field.onChange(value)}
                disabled={!!phoneCubidSDK}
              />
            )}
          />

          {!otpSent && (
            <Button disabled={loading} onClick={sendOTP}>
              Send OTP
            </Button>
          )}

          {otpSent && !otpVerified && (
            <>
              <Controller
                name="otp"
                control={control}
                render={({ field }) => (
                  <InputField label="OTP" placeholder="Enter OTP" {...field} fullWidth />
                )}
              />
              <Button disabled={loading} onClick={verifyOTP}>
                Verify OTP
              </Button>
            </>
          )}

          <Controller
            name="interac_email"
            control={control}
            render={({ field }) => (
              <InputField label="Interac Email" placeholder="Interac Email" {...field} fullWidth />
            )}
          />

          {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

          <Button
            disabled={loading || !otpVerified || donationAmount > userBalance}
            type="submit"
          >
            Convert and Transfer
          </Button>
        </div>
      </div>
    </form>
  );
};

export { OffRampModal };
