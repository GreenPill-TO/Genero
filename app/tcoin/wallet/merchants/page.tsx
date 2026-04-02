import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { LandingHeader } from "@tcoin/wallet/components/landing-header";
import { Footer } from "@tcoin/wallet/components/footer";

const baseUrl = "https://tcoin.me";

export const metadata: Metadata = {
  title: "TCOIN for Merchants",
  description:
    "See how TCOIN helps merchants turn prepaid sales into repeat business, lower fees, and stronger local trade.",
  openGraph: {
    title: "TCOIN for Merchants",
    description:
      "See how TCOIN helps merchants turn prepaid sales into repeat business, lower fees, and stronger local trade.",
    type: "website",
    url: `${baseUrl}/merchants`,
  },
  twitter: {
    card: "summary_large_image",
    title: "TCOIN for Merchants",
    description:
      "See how TCOIN helps merchants turn prepaid sales into repeat business, lower fees, and stronger local trade.",
  },
  alternates: {
    canonical: `${baseUrl}/merchants`,
  },
};

const merchantSections = [
  {
    title: "Sell more, upfront",
    body:
      "TCOIN lets you mint vouchers that work like digital gift cards. Customers can prepay and spend later—giving you cash flow today and guaranteed future business.",
  },
  {
    title: "More useful than gift cards",
    body:
      "Unlike traditional gift cards, your vouchers aren’t locked to your store. They can be traded across participating merchants, making them far more flexible—and more appealing to customers.",
  },
  {
    title: "Join a merchant network",
    body:
      "Accept vouchers from other businesses and use what you earn to spend within the network. It’s like exchanging value with other merchants—no middleman, no friction.",
  },
  {
    title: "Lower fees, better margins",
    body:
      "Cash out at fees lower than typical credit card rates. Or avoid fees entirely by trading vouchers directly with other merchants.",
  },
  {
    title: "Attract values-driven customers",
    body:
      "Choose a charity to support with your transaction fees. Customers know their spending contributes to something meaningful.",
  },
  {
    title: "Keep customers coming back",
    body:
      "Prepaid value encourages repeat visits and builds stronger customer relationships over time.",
  },
  {
    title: "Have a voice in the system",
    body:
      "You’re not just a participant—you help shape the network. Support and influence representatives who guide governance and key decisions.",
  },
  {
    title: "Simple to start",
    body:
      "No complex setup. Mint vouchers, accept payments, and start participating right away. The first step is to log in, sign up as an individual. Then go to the Merchant Signup Page and let us know about where you are and what you sell.",
  },
];

export default function MerchantsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground text-base">
      <LandingHeader />
      <main className="flex-grow pt-40 px-6 max-w-screen-xl mx-auto lg:w-3/5 space-y-10 bg-background">
        <section className="space-y-5 text-center">
          <h1 className="font-extrabold text-center">For Merchants</h1>
          <p className="text-lg leading-8">
            Turn your everyday sales into a smarter system that brings customers back, reduces
            fees, and connects you with other local businesses.
          </p>
        </section>

        <section className="space-y-6">
          {merchantSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="font-extrabold text-center">{section.title}</h2>
              <p className="leading-8">{section.body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-5 pb-2">
          <p className="text-lg leading-8">
            TCOIN isn’t just a payment method—it’s a way to grow your business, strengthen your
            community, and keep more value circulating locally.
          </p>
          <p>
            <Link href="/">Return home</Link>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
