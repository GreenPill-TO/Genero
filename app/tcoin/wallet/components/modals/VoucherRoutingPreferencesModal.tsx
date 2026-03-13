import React from "react";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";

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
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Voucher routing preferences let you control how payments are routed when voucher paths are available for a
          merchant or token.
        </p>
        <p>
          Use these settings to trust, block, or keep default behavior for specific merchant/token combinations. If you
          leave fields blank, the preference applies more broadly.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="voucher-merchant-store-id" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="voucher-token-address" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="voucher-trust-status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Trust Status
          </label>
          <select
            id="voucher-trust-status"
            value={voucherPreferenceForm.trustStatus}
            onChange={(event) =>
              setVoucherPreferenceForm((prev) => ({
                ...prev,
                trustStatus: event.target.value,
              }))
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="default">Default</option>
            <option value="trusted">Trusted</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={closeModal}>
          Close
        </Button>
        <Button type="button" onClick={() => void onSave()} disabled={isSaving}>
          {isSaving ? "Saving Preference…" : "Save Voucher Preference"}
        </Button>
      </div>
    </div>
  );
}
