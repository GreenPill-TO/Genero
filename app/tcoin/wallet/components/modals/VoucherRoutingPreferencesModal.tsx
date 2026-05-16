import React from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import {
  walletBadgeClass,
  walletChoiceCardClass,
  walletPanelMutedClass,
  walletSectionLabelClass,
} from "@tcoin/wallet/components/dashboard/authenticated-ui";
import { cn } from "@shared/utils/classnames";

type VoucherPreferenceForm = {
  merchantStoreId: string;
  tokenAddress: string;
  trustStatus: string;
};

type VoucherRoutingPreferencesModalProps = {
  closeModal: () => void;
  voucherPreferenceForm: VoucherPreferenceForm;
  setVoucherPreferenceForm: React.Dispatch<React.SetStateAction<VoucherPreferenceForm>>;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
};

export function VoucherRoutingPreferencesModal({
  closeModal,
  voucherPreferenceForm,
  setVoucherPreferenceForm,
  onSave,
  isSaving,
}: VoucherRoutingPreferencesModalProps) {
  const trustOptions = [
    {
      value: "default",
      title: "Default",
      description: "Let the wallet decide using the normal routing rules.",
    },
    {
      value: "trusted",
      title: "Trusted",
      description: "Prefer this route when it is available.",
    },
    {
      value: "blocked",
      title: "Blocked",
      description: "Avoid this route even if it is otherwise available.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={walletBadgeClass}>Voucher routing</span>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Voucher routing preferences let you control how payments are routed when voucher paths are available for a merchant or token.
          </p>
          <p>
            Leave the merchant or token fields blank to apply the rule more broadly. Use trusted or blocked only when you want to override normal wallet behaviour.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className={walletPanelMutedClass}>
          <label htmlFor="voucher-merchant-store-id" className={walletSectionLabelClass}>
            Merchant Store ID (optional)
          </label>
          <Input
            id="voucher-merchant-store-id"
            type="text"
            value={voucherPreferenceForm.merchantStoreId}
            onChange={(event) =>
              setVoucherPreferenceForm((prev) => ({
                ...prev,
                merchantStoreId: event.target.value,
              }))
            }
            placeholder="Merchant store id"
            className="mt-3"
          />
        </div>

        <div className={walletPanelMutedClass}>
          <label htmlFor="voucher-token-address" className={walletSectionLabelClass}>
            Token Address (optional)
          </label>
          <Input
            id="voucher-token-address"
            type="text"
            value={voucherPreferenceForm.tokenAddress}
            onChange={(event) =>
              setVoucherPreferenceForm((prev) => ({
                ...prev,
                tokenAddress: event.target.value,
              }))
            }
            placeholder="0x..."
            className="mt-3"
          />
        </div>

        <div className="space-y-3">
          <p className={walletSectionLabelClass}>Trust status</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {trustOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  walletChoiceCardClass,
                  voucherPreferenceForm.trustStatus === option.value
                    ? "border-teal-500/70 bg-teal-50 dark:bg-teal-500/10"
                    : ""
                )}
                onClick={() =>
                  setVoucherPreferenceForm((prev) => ({
                    ...prev,
                    trustStatus: option.value,
                  }))
                }
              >
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{option.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={closeModal} className="rounded-full">
          Close
        </Button>
        <Button type="button" onClick={() => void onSave()} className="rounded-full" disabled={isSaving}>
          {isSaving ? "Saving Preference…" : "Save Voucher Preference"}
        </Button>
      </div>
    </div>
  );
}
