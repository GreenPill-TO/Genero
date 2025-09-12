import React from "react";
import { LuCreditCard, LuDollarSign } from "react-icons/lu";
import { Button } from "@shared/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/Card";
import { OffRampModal } from "@tcoin/wallet/components/modals";
import { TopUpModal } from "@tcoin/wallet/components/modals/TopUpModal";

export function OtherCard({
  openModal,
  closeModal,
  tokenLabel = "Tcoin",
}: {
  openModal: any;
  closeModal: any;
  tokenLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            className="w-full"
            onClick={() => {
              openModal({
                content: <TopUpModal closeModal={closeModal} tokenLabel={tokenLabel} />,
                title: "Top Up with Interac eTransfer",
                description: `Send an Interac eTransfer to top up your ${tokenLabel.toUpperCase()} Balance.`,
              });
            }}
          >
            <LuCreditCard className="mr-2 h-4 w-4" /> Top Up with Interac eTransfer
          </Button>
          <Button
            className="w-full"
            onClick={() => {
              openModal({
                content: <OffRampModal closeModal={closeModal} />,
                title: "Convert and Off-ramp",
                description: "Convert your TCOIN to CAD and transfer to your bank account.",
              });
            }}
          >
            <LuDollarSign className="mr-2 h-4 w-4" /> Convert to CAD and Cash Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
