import { Button } from "@shared/components/ui/Button";
import InputField from "@shared/components/ui/InputField";
import { cn } from "@shared/utils/classnames";
import React, { useState } from "react";

interface PaymentFormProps {
  onSubmit: (paymentData: { cardNumber: string; expiryDate: string; cvv: string }) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ onSubmit }) => {
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ cardNumber, expiryDate, cvv });
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form space-y-4">
      <InputField label="Card Number" name="cardNumber" type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required />
      <InputField label="Expiry Date" name="expiryDate" type="text" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
      <InputField label="CVV" name="cvv" type="text" value={cvv} onChange={(e) => setCvv(e.target.value)} required />
      <Button type="submit" className={cn("inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium")}>
        Submit Payment
      </Button>
    </form>
  );
};

export default PaymentForm;
