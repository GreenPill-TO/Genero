// Modal.tsx
import { ModalContentType } from "@shared/contexts/ModalContext";
import { cn } from "@shared/utils/classnames";
import React from "react";

interface ModalProps {
  modalContent: ModalContentType | null;
  closeModal: () => void;
}

const Modal: React.FC<ModalProps> = ({ modalContent, closeModal }) => {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
  };

  return (
    <div className={cn("modal modal-open !bg-black !bg-opacity-[75%] text-foreground", modalContent?.isResponsive ? "modal-bottom sm:modal-middle" : "")}>
      <div className={cn("modal-box bg-card", modalContent?.elSize ? sizeClasses[modalContent?.elSize] : "w-content")}>
        <h2 className="font-bold text-lg modal-title">{modalContent?.title}</h2>
        <p className="text-sm text-muted-foreground">{modalContent?.description}</p>
        <div className="mt-4">{modalContent?.content}</div>
        <div className="modal-action mt-0">
          {/* <button onClick={closeModal} className="btn">
            Close
          </button> */}
          <button onClick={closeModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={closeModal}></div>
    </div>
  );
};

export default Modal;
