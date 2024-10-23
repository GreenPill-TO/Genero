"use client";
// ModalContext.tsx
import Modal from "@shared/components/ui/Modal";
import React, { createContext, ReactNode, useContext, useState } from "react";

export interface ModalContentType {
  content?: ReactNode | null;
  title?: string;
  description?: string;
  elSize?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
  isResponsive?: boolean;
}
interface ModalContextType {
  isOpen: boolean;
  modalContent: ModalContentType | null;
  openModal: (content: ModalContentType) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<ModalContentType | null>(null);

  const openModal = ({ content = null, title = "", description = "", elSize = "md", isResponsive = false }: ModalContentType) => {
    setModalContent({ content, title, elSize, isResponsive, description });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalContent(null);
  };

  return (
    <ModalContext.Provider value={{ isOpen, modalContent, openModal, closeModal }}>
      {children}
      {isOpen && <Modal modalContent={modalContent} closeModal={closeModal} />}
    </ModalContext.Provider>
  );
};
