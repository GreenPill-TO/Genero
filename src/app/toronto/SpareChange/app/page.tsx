"use client";

import { useModal } from "@shared/contexts/ModalContext";
import SignInModal from "@toronto/sparechange/components/modal/SignInModal";
import { CallToAction, Features, Hero, HowItWorks, Testimonials } from "./home";

export default function Home() {
  const { openModal, closeModal } = useModal();

  const handleAuthClick = () => {
    openModal({ content: <SignInModal closeModal={closeModal} extraObject={{ isSignIn: true }} />, elSize: "4xl" });
  };

  return (
    <div>
      <Hero onAuthClick={handleAuthClick} />
      <Features />
      <HowItWorks onAuthClick={handleAuthClick} />
      <Testimonials />
      <CallToAction onAuthClick={handleAuthClick} />
    </div>
  );
}
