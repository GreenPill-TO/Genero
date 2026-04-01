// OffRampModal.tsx
// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import InputField from "@shared/components/ui/InputField";
import { useSendMoney } from "@shared/hooks/useSendMoney";
import { useForm, Controller } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import { createLegacyOfframpRequest, createRedemptionRequest } from "@shared/lib/edge/redemptionsClient";
import {
  walletBadgeClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";

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
  const [isPhoneLookupUnavailable, setIsPhoneLookupUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { userData } = useAuth();
  const { burnMoney, senderWallet } = useSendMoney({ senderId: userData?.cubidData?.id });
  const { exchangeRate, state: exchangeRateState } = useControlVariables();

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
    let isActive = true;
    const loadSDK = async () => {
      const cubidUserId = userData?.user?.cubid_id;
      if (!cubidUserId) {
        if (isActive) {
          setPhoneCubidSDK("");
          setIsPhoneLookupUnavailable(false);
        }
        return;
      }

      try {
        const { CubidSDK } = await import("cubid-sdk");
        const cubid_sdk = new CubidSDK(57, "14475a54-5bbe-4f3f-81c7-ff4403ad0830");
        const cubid_stamps = await cubid_sdk.fetchStamps({ user_id: cubidUserId });
        const phoneStamp = cubid_stamps.all_stamps.find((item) => item.stamptype_string === "phone")?.uniquevalue;

        if (!isActive) {
          return;
        }

        if (phoneStamp) {
          setPhoneCubidSDK(phoneStamp);
          setValue("phone_number", phoneStamp);
        } else {
          setPhoneCubidSDK("");
        }
        setIsPhoneLookupUnavailable(false);
      } catch (error) {
        console.error("Unable to prefill the phone number from Cubid.", error);
        if (!isActive) {
          return;
        }
        setPhoneCubidSDK("");
        setIsPhoneLookupUnavailable(true);
      }
    };
    void loadSDK();
    return () => {
      isActive = false;
    };
  }, [setValue, userData?.user?.cubid_id]);

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

    try {
      setLoading(true);

      const offRampRequestId = uuidv4();
      const transactionId = uuidv4();

      const isStoreOwner = userData?.isStoreOwner || false;
      const feePercentage = isStoreOwner ? 0.02 : 0.05;
      const CAD_offramp_fee = parseFloat((estimatedCAD * feePercentage).toFixed(2));
      const CAD_to_user = parseFloat((estimatedCAD - CAD_offramp_fee).toFixed(2));

      await burnMoney(donationAmount);
      const legacyOfframp = await createLegacyOfframpRequest(
        {
          currentTokenBalance: String(userBalance),
          etransferTarget: data.interac_email,
          isStore: 1,
          tokensBurned: Number((estimatedCAD / exchangeRate).toFixed(2)),
          userId: userData?.cubidData?.id,
          walletAccountFrom: senderWallet,
          walletAccountTo: null,
          exchangeRate,
        },
        { citySlug: "tcoin" }
      );
      const legacyOfframpRequest = (legacyOfframp as { request?: { id?: number } }).request;

      if (isStoreOwner) {
        const storeId = Number(userData?.storeId ?? 0);
        if (Number.isFinite(storeId) && storeId > 0) {
          await createRedemptionRequest(
            {
              storeId,
              tokenAmount: donationAmount,
              settlementAsset: "CAD",
              settlementAmount: CAD_to_user,
              metadata: {
                offRampReqId: legacyOfframpRequest?.id ?? null,
                offRampRequestUuid: offRampRequestId,
                transactionId,
              },
            },
            { citySlug: "tcoin" }
          );
        }
      }

      reset();
      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete off-ramp.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-5">
        <div className="space-y-2">
          <span className={walletBadgeClass}>Cash out</span>
          <p className="text-sm text-muted-foreground">
            Redeem TCOIN for CAD and send it to your bank account once the phone verification step is complete.
          </p>
        </div>

        <div className={`${walletPanelMutedClass} grid gap-3 sm:grid-cols-2`}>
          <div>
            <p className={walletSectionLabelClass}>Available balance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{userBalance.toFixed(2)} TCOIN</p>
          </div>
          <div>
            <p className={walletSectionLabelClass}>Estimated CAD</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">${estimatedCAD.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className={walletPanelMutedClass}>
          <Controller
            name="preferredDonationAmount"
            control={control}
            render={({ field }) => (
              <InputField {...field} label="TCOIN amount to redeem (TCOIN)" type="number" fullWidth />
            )}
          />
          <p className="mt-3 text-sm text-muted-foreground">Estimated CAD: ${estimatedCAD.toFixed(2)}</p>
          {exchangeRateState !== "ready" && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              CAD values are using a fallback estimate until the live city rate is indexed.
            </p>
          )}
          {donationAmount > userBalance && (
            <p className="mt-2 text-sm text-red-500">
              Warning: The entered TCOIN amount exceeds your available balance of {userBalance}.
            </p>
          )}
          </div>

          <div className={walletPanelMutedClass}>
            <p className={walletSectionLabelClass}>Phone verification</p>
            {isPhoneLookupUnavailable ? (
              <p className="mt-3 text-xs text-muted-foreground">
                We couldn&apos;t load your verified phone automatically, so enter it manually below.
              </p>
            ) : null}
            <div className="mt-3">
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
            </div>

          {!otpSent && (
            <Button type="button" className="mt-4 rounded-full" disabled={loading} onClick={sendOTP}>
              Send verification code
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
              <Button type="button" className="rounded-full" disabled={loading} onClick={verifyOTP}>
                Confirm code
              </Button>
            </>
          )}
          </div>

          <div className={walletPanelMutedClass}>
            <p className={walletSectionLabelClass}>Bank transfer details</p>
            <div className="mt-3">
          <Controller
            name="interac_email"
            control={control}
            render={({ field }) => (
              <InputField label="Interac Email" placeholder="Interac Email" {...field} fullWidth />
            )}
          />
            </div>
          </div>

          {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

          <Button
            disabled={loading || !otpVerified || donationAmount > userBalance}
            className="rounded-full"
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
