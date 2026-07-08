"use client";
import React from "react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Textarea } from "@shared/components/ui/TextArea";
import { Button } from "@shared/components/ui/Button";
import { LandingHeader } from "@tcoin/wallet/components/landing-header";
import { Footer } from "@tcoin/wallet/components/footer";
import { createUserRequest } from "@shared/lib/edge/userRequestsClient";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createUserRequest({ name, email, message });

      setSubmitted(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to send your message right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground text-base">
      <LandingHeader />
      <main className="flex-grow pt-40 px-6 max-w-screen-xl mx-auto lg:w-3/5 space-y-4 bg-background">
        <h1 className="font-extrabold text-center my-5">Contact</h1>
        <p>
          Get in Touch? Help out? We want to hear from you. We're a small and friendly team and would love your input, insights and any help you can offer. {" "}
          Join our{" "}
          <Link href="https://chat.whatsapp.com/EXF4AkkksYA0fY26nQhrTv" target="_blank">
            WhatsApp
          </Link>
        </p>
        {submitted ? (
          <>
            <p>Thanks for reaching out! We'll be in touch.</p>
            <p className="mt-8">
              <Link href="/">Return Home</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mr-2" htmlFor="name">Name</label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mr-2" htmlFor="email">Email</label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mr-2" htmlFor="message">Message</label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-40"
                required
              />
            </div>
            {submitError && (
              <p className="text-red-600 dark:text-red-400" role="alert">
                {submitError}
              </p>
            )}
            <div className="mt-8 flex items-center justify-between">
              <Link href="/">Return Home</Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#05656F] text-white hover:bg-[#05656F]/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              >
                {isSubmitting ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
