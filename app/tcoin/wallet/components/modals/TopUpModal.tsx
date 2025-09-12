import React, { useEffect, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { useAuth } from "@shared/api/hooks/useAuth";
import { createClient } from "@shared/lib/supabase/client";
import { toast } from "react-toastify";
import { insertSuccessNotification, adminInsertNotification } from "@shared/utils/insertNotification";
import { useControlVariables } from "@shared/hooks/useGetLatestExchangeRate";

const generateReferenceCode = () => {
  const base = "TCOIN-REF";
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `${base}-${randomPart}`;
};

export function TopUpModal({ closeModal, tokenLabel = "Tcoin" }: { closeModal: any; tokenLabel?: string }) {
  const [step, setStep] = useState("input");
  const [amount, setAmount] = useState("");
  const [refCode, setRefCode] = useState(generateReferenceCode());
  const { userData } = useAuth();
  const supabase = createClient();
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
    await supabase.from("interac_transfer").insert({
      user_id: userData?.cubidData?.id,
      interac_code: refCode,
      is_sent: false,
      amount: amount,
    });
    setStep("confirmation");
  };

  const handleBack = () => {
    setStep("input");
  };

  const handleCancel = () => {
    closeModal();
  };

  const handleConfirm = async () => {
    try {
      await supabase
        .from("interac_transfer")
        .update({ is_sent: true })
        .match({ interac_code: refCode });
      const { data: interac_transfer_id } = await supabase
        .from("interac_transfer")
        .select("*")
        .match({ interac_code: refCode });
      const { data: acc_transactions } = await supabase
        .from("act_transactions")
        .insert({
          transaction_category: "transfer",
          created_by: userData?.cubidData.id,
          onramp_request_id: interac_transfer_id?.[0]?.id,
        })
        .select("*");
      toast.success("Top up recorded successfully!");
      await insertSuccessNotification({
        user_id: userData?.cubidData.id,
        notification: `${amount} topped up successfully into ${tokenLabel} Wallet`,
        additionalData: {
          trx_entry_id: acc_transactions?.[0]?.id,
        },
      });
      await adminInsertNotification({
        user_id: userData?.cubidData.id,
        notification: `Sent ${amount} to ${tokenLabel.toUpperCase()} wallet needs to be verified`,
      });
      setRefCode(generateReferenceCode());
      setStep("final");
    } catch (error) {
      toast.error("Failed to record top up. Please try again.");
    }
  };

  const { exchangeRate } = useControlVariables();

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
          {Boolean(amount) && <div className="mb-4">{amount * exchangeRate} CAD</div>}
        </div>
      )}

      {step === "confirmation" && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Confirm Top Up</h3>
          <p>
            <strong>Amount:</strong> {amount}
          </p>
          <p>
            <strong>Amount in CAD:</strong> {amount * exchangeRate}
          </p>
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
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>I have sent it</Button>
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
