"use client";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Textarea } from "@shared/components/ui/TextArea";
import { Button } from "@shared/components/ui/Button";
import { TextPage } from "@tcoin/wallet/components/text-page";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/user_requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });
    if (res.ok) {
      setSubmitted(true);
      setName("");
      setEmail("");
      setMessage("");
    }
  };

  return (
    <TextPage className="space-y-4">
        <h1 className="font-extrabold text-center my-5">Contact</h1>
        <p>
          Get in Touch? Help out? We want to hear from you. We're a small and friendly team and would love your input, insights and any help you can offer. {" "}
          <Link href="https://chat.whatsapp.com/EXF4AkkksYA0fY26nQhrTv" target="_blank">Join our WhatsApp</Link>
        </p>
        {submitted ? (
          <p>Thanks for reaching out! We'll be in touch.</p>
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
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <Button
              type="submit"
              className="mb-4 bg-[#05656F] text-white hover:bg-[#05656F]/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Send
            </Button>
          </form>
        )}
        <p className="mt-8">
          <Link href="/">Return home</Link>
        </p>
    </TextPage>
  );
}
