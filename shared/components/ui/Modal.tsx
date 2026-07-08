// Modal.tsx
import { ModalContentType } from "@shared/contexts/ModalContext";
import { cn } from "@shared/utils/classnames";
import React from "react";

interface ModalProps {
  modalContent: ModalContentType | null;
  closeModal: () => void;
  modalThemeClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
  modalContent,
  closeModal,
  modalThemeClassName,
}) => {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };
  const useWalletAuthTheme = Boolean(modalThemeClassName);

  return (
    <div
      className={cn(
        "modal modal-open !bg-black !bg-opacity-[75%] text-foreground",
        modalContent?.isResponsive ? "modal-bottom sm:modal-middle" : "",
        modalThemeClassName
      )}
    >
      <div
        className={cn(
          "modal-box relative",
          modalContent?.elSize ? sizeClasses[modalContent?.elSize] : "w-content",
          useWalletAuthTheme
            ? "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,249,0.92))] font-sans text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.2)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,25,34,0.96),rgba(10,15,21,0.94))] dark:text-slate-50 dark:shadow-[0_32px_80px_rgba(2,6,23,0.55)]"
            : "bg-card"
        )}
      >
        {modalContent?.title ? (
          <h2 className={cn("modal-title text-lg font-bold", useWalletAuthTheme && "font-sans")}>
            {modalContent.title}
          </h2>
        ) : null}
        {modalContent?.description ? (
          <p className={cn("text-sm text-muted-foreground", useWalletAuthTheme && "font-sans")}>
            {modalContent.description}
          </p>
        ) : null}
        <div className="mt-4">{modalContent?.content}</div>
        <div className="modal-action mt-0">
          <button
            onClick={closeModal}
            className={cn(
              "absolute right-2 top-2",
              useWalletAuthTheme
                ? "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/75 font-sans text-base text-slate-600 transition hover:bg-white dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.12]"
                : "btn btn-sm btn-circle btn-ghost"
            )}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={closeModal}></div>
    </div>
  );
};

export default Modal;
