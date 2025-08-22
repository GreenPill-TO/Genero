"use client";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Textarea } from "@shared/components/ui/TextArea";
import { Button } from "@shared/components/ui/Button";
import { LandingHeader } from "@tcoin/wallet/components/landing-header";
import { Footer } from "@tcoin/wallet/components/footer";

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
    <div className="min-h-screen flex flex-col bg-white text-gray-800 text-base">
      <LandingHeader />
      <main className="flex-grow pt-72 px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%] space-y-4">
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
            <Button type="submit">Send</Button>
          </form>
        )}
        <p>
          <Link href="/">Return home</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
