import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import InputField from "@shared/components/ui/InputField";
import { useState } from "react";
import useEscapeKey from "@shared/hooks/useEscapeKey";

interface OffRampProps {
  closeModal: () => void;
}

const OffRampModal = ({ closeModal }: OffRampProps) => {
  const [amount, setAmount] = useState(0);
  useEscapeKey(closeModal);

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <InputField
          label="TCOIN amount to redeem (TCOIN)"
          name="preferredDonationAmount"
          type="number"
          value={amount}
          placeholder="Amount in TCOIN"
          fullWidth
          onChange={(e) => {
            setAmount(parseFloat(e.currentTarget.value));
          }}
        />
        <p>Estimated CAD: $0.00</p>
        <Input placeholder="Interac eTransfer email or phone" className="w-full" />
        <p className="text-sm text-gray-500">Note: The transfer will be completed within the next 24 hours.</p>
        <Button className="w-full">Convert and Transfer</Button>
      </div>
    </div>
  );
};

export { OffRampModal };
