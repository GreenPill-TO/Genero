// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { useAuth } from '@shared/api/hooks/useAuth';
import { createLegacyInteracReference } from '@shared/lib/edge/onrampClient';

interface TopUpModalProps {
  closeModal: () => void;
}

const TopUpModal = ({ closeModal }: TopUpModalProps) => {
  const [reference, setReference] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const { userData } = useAuth()

  useEffect(() => {
    const fetchOrCreateReference = async () => {
      const newReference = nanoid(5).toUpperCase();
      try {
        await createLegacyInteracReference(
          { amount: 0.01, refCode: newReference },
          { citySlug: 'tcoin' }
        );
        setReference(newReference);
      } catch (error) {
        console.error('Error creating Interac transfer reference:', error);
      }

      setLoading(false);
    };

    fetchOrCreateReference();
  }, [userData?.cubidData?.id]);

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
