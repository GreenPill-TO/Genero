// @ts-nocheck
import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import InputField from "@shared/components/ui/InputField";
import { createClient } from "@shared/lib/supabase/client";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";

interface OffRampProps {
  closeModal: () => void;
}

interface OffRampFormValues {
  preferredDonationAmount: number;
  interac_transfer: string;
}

const supabase = createClient()

const OffRampModal = ({ closeModal }: OffRampProps) => {
  const {
    control,
    handleSubmit,
    watch,
    reset,
  } = useForm<OffRampFormValues>({
    defaultValues: {
      preferredDonationAmount: '',
      interac_transfer: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const { userData } = useAuth()

  // Watch the donation amount to compute the estimated CAD
  const donationAmount = watch("preferredDonationAmount") || 0;
  const estimatedCAD = donationAmount * 3.3;

  const onSubmit = async (data: OffRampFormValues) => {
    setLoading(true);

    // Insert data into the off_ramp_req table
    const { error } = await supabase.from("off_ramp_req").insert([
      {
        cad: (data.preferredDonationAmount * 3.3).toFixed(2), // storing as string
        user_id: (userData as any)?.cubidData?.id, // Adjust based on your user ID structure
        interac_transfer: data.interac_transfer,
      },
    ]);

    setLoading(false);

    if (error) {
      console.error("Error inserting off-ramp request:", error);
      // Optionally show an error message to the user
    } else {
      reset();
      closeModal();
    }
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
              <Input
                {...field}
                placeholder="Interac eTransfer email or phone"
                className="w-full"
                type="email"
              />
            )}
          />
          <p className="text-sm text-gray-500">
            Note: The transfer will be completed within the next 24 hours.
          </p>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Processing..." : "Convert and Transfer"}
          </Button>
        </div>
      </div>
    </form>
  );
};

export { OffRampModal };