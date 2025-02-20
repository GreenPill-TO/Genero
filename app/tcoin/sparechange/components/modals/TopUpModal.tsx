// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { createClient } from '@shared/lib/supabase/client';
import { useAuth } from '@shared/api/hooks/useAuth';

interface TopUpModalProps {
  closeModal: () => void;
}

const supabase = createClient()

const TopUpModal = ({ closeModal }: TopUpModalProps) => {
  const [reference, setReference] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const { userData } = useAuth()

  useEffect(() => {
    const fetchOrCreateReference = async () => {
      // Get the currently authenticated user
      // Try to fetch an existing record from the 'interac_transfer' table
      const { data, error } = await supabase
        .from('interac_transfer')
        .select('*')
        .eq('user_id', userData?.cubidData?.id)

      if (error) {
        console.error('Error fetching interac_transfer record:', error);
      }

      if (data?.[0] && data?.[0]?.interac_code) {
        // If a record exists, use its reference
        setReference(data?.[0]?.interac_code);
      } else {
        // If no record exists, generate a new reference using nanoid
        const newReference = nanoid(5).toUpperCase();
        // Insert the new record into the table
        const { error: insertError } = await supabase
          .from('interac_transfer')
          .insert({ user_id: userData?.cubidData?.id, interac_code: newReference });

        if (insertError) {
          console.error('Error inserting new interac_transfer record:', insertError);
        }
        setReference(newReference);
      }

      setLoading(false);
    };

    fetchOrCreateReference();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <p>
          <strong>Destination email:</strong> topup@tcoin.me
        </p>
        <p>
          <strong>Reference number:</strong> {reference}
        </p>
        <p className="text-sm text-gray-500">
          Note: You must send the eTransfer from a bank account with the same owner as this TCOIN account. The balance will show up within 24 hours.
        </p>
      </div>
    </div>
  );
};

export { TopUpModal };