"use client";
import React from "react";
import { Button } from "@shared/components/ui/Button";
import useEscapeKey from "@shared/hooks/useEscapeKey";
import { ModalContentType } from "@shared/contexts/ModalContext";
import { ContactSelectModal } from "./ContactSelectModal";

interface BlankAmountModalProps {
  closeModal: () => void;
  openModal: (content: ModalContentType) => void;
}

const BlankAmountModal = ({ closeModal, openModal }: BlankAmountModalProps) => {
  useEscapeKey(closeModal);
  return (
    <div className="mt-2 p-0">
      <p>Did you forget the value?</p>
      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="outline" onClick={closeModal}>
          Back
        </Button>
        <Button
          onClick={() =>
            openModal({
              content: (
                <ContactSelectModal
                  closeModal={closeModal}
                  amount="0"
                  method="Request"
                  setToSendData={() => {}}
                />
              ),
              title: "Request from Contact",
              description: "Select a contact to request TCOIN from.",
            })
          }
        >
          Send blank request
        </Button>
      </div>
    </div>
  );
};

export { BlankAmountModal };
