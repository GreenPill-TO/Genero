import React, { useEffect, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useAuth } from "@shared/api/hooks/useAuth";
import { toast } from "react-toastify";
import { insertSuccessNotification, adminInsertNotification } from "@shared/utils/insertNotification";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";
import {
  confirmLegacyInteracReference,
  createLegacyInteracReference,
} from "@shared/lib/edge/onrampClient";

const generateReferenceCode = () => {
  const base = "TCOIN-REF";
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `${base}-${randomPart}`;
};

function calculateFiatAmount(tokenAmount: number, exchangeRate: unknown): number {
  if (!Number.isFinite(tokenAmount)) {
    return 0;
  }
  return typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0
    ? tokenAmount * exchangeRate
    : tokenAmount;
}

export function TopUpModal({ closeModal, tokenLabel = "Tcoin" }: { closeModal: any; tokenLabel?: string }) {
  const [step, setStep] = useState("input");
  const [amount, setAmount] = useState("");
  const [refCode, setRefCode] = useState(generateReferenceCode());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userData } = useAuth();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeModal]);

  const handleNext = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    try {
      await createLegacyInteracReference(
        {
          amount,
          refCode,
        },
        { citySlug: "tcoin" }
      );
      setStep("confirmation");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Top up is not available right now. Please try again in a moment.";
      toast.error(message);
    }
  };

  const handleBack = () => {
    setStep("input");
  };

  const handleCancel = () => {
    closeModal();
  };

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      const userId = userData?.cubidData?.id;
      if (typeof userId !== "number") {
        throw new Error("Could not resolve your user id for top-up routing.");
      }

      const confirmation = await confirmLegacyInteracReference(
        { refCode },
        { citySlug: "tcoin" }
      );
      const interacTransfer = (confirmation as { transfer?: { id?: number } }).transfer;
      const accountingTransaction = (confirmation as { transaction?: { id?: number } }).transaction;

      const tokenAmount = Number.parseFloat(amount);
      const fiatAmount = calculateFiatAmount(tokenAmount, exchangeRate);

      if (Number.isFinite(tokenAmount) && tokenAmount > 0) {
        const buyResponse = await fetch("/api/pools/buy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tokenAmount,
            fiatAmount,
            metadata: {
              interacCode: refCode,
              interacTransferId: interacTransfer?.id ?? null,
              accountingTransactionId: accountingTransaction?.id ?? null,
            },
          }),
        });

        const buyBody = (await buyResponse.json()) as { error?: string };
        if (!buyResponse.ok) {
          throw new Error(
            buyBody.error ??
              "Top-up request was recorded but BIA pool routing failed. Please select your BIA and retry."
          );
        }
      }

      toast.success("Top up recorded successfully!");
      await insertSuccessNotification({
        user_id: userId,
        notification: `${amount} topped up successfully into ${tokenLabel} Wallet`,
          additionalData: {
          trx_entry_id: accountingTransaction?.id ?? null,
        },
      });
      await adminInsertNotification({
        user_id: String(userId),
        notification: `Sent ${amount} to ${tokenLabel.toUpperCase()} wallet needs to be verified`,
      });
      setRefCode(generateReferenceCode());
      setStep("final");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to record top up. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { exchangeRate, fallbackMessage } = useControlVariables();
  const parsedAmount = Number.parseFloat(amount);
  const amountInCad = calculateFiatAmount(parsedAmount, exchangeRate);

  return (
    <div className="p-4 pb-0 space-y-6">
      {step === "input" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Top Up via Interac eTransfer</h3>
          <h3 className="text-sm font-bold">{tokenLabel.toUpperCase()} amount to top up</h3>
          <div className="justify-between space-x-4 flex w-full">
            <Input
              type="number"
              placeholder={`Enter amount of ${tokenLabel.toUpperCase()}`}
              className="border-gray-500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div>
              <Button onClick={handleNext}>Next</Button>
            </div>
          </div>
          {Boolean(amount) && <div className="mb-2">{amountInCad} CAD</div>}
          {fallbackMessage ? (
            <p className="mb-4 text-xs text-amber-700 dark:text-amber-300">{fallbackMessage}</p>
          ) : null}
        </div>
      )}

      {step === "confirmation" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Confirm Top Up</h3>
          <p>
            <strong>Amount:</strong> {amount}
          </p>
          <p>
            <strong>Amount in CAD:</strong> {amountInCad}
          </p>
          {fallbackMessage ? <p className="text-xs text-amber-700 dark:text-amber-300">{fallbackMessage}</p> : null}
          <p>
            <strong>Reference Code:</strong> {refCode}
          </p>
          <p>
            <strong>eTransfer money to:</strong> support@tcoin.com
          </p>
          <p className="text-sm text-gray-500">
            Make sure you have a confirmation from your bank that the money has been sent before finalizing here.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              Back
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "I have sent it"}
            </Button>
          </div>
        </div>
      )}

      {step === "final" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Thank You!</h3>
          <p>
            Thank you! Check back here in 24 hours when the {tokenLabel.toUpperCase()} balance should be updated.
          </p>
          <div className="flex justify-end">
            <Button onClick={closeModal}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
