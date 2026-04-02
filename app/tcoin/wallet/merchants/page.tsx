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

export default function MerchantsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground text-base">
      <LandingHeader />
      <main className="flex-grow pt-48 sm:pt-52 px-6 max-w-screen-xl mx-auto lg:w-3/5 space-y-10 bg-background">
        <section className="space-y-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-foreground/20 px-4 py-2 text-sm hover:border-foreground/40"
            >
              Return home
            </Link>
          </div>
        </section>

        <section className="space-y-5 text-center">
          <h1 className="font-extrabold text-center">For Merchants</h1>
          <p className="text-lg leading-8">
            Turn your everyday sales into a smarter system that brings customers back, reduces
            fees, and connects you with other local businesses.
          </p>
          <p className="leading-8">
            TCOIN isn’t just a payment method—it’s a way to grow your business, strengthen your
            community, and keep more value circulating locally.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-extrabold text-center">Benefits for Merchants</h2>
          <p className="leading-8">
            <strong>Sell more, upfront.</strong> TCOIN lets you mint vouchers that work like
            digital gift cards. Customers can prepay and spend later—giving you cash flow today
            and guaranteed future business.
          </p>
          <p className="leading-8">
            <strong>More useful than gift cards.</strong> Unlike traditional gift cards, your
            vouchers aren’t locked to your store. They can be traded across participating
            merchants, making them far more flexible—and more appealing to customers.
          </p>
          <p className="leading-8">
            <strong>Lower fees, better margins.</strong> Cash out at fees lower than typical
            credit card rates. Or avoid fees entirely by trading vouchers directly with other
            merchants.
          </p>
          <p className="leading-8">
            <strong>Keep customers coming back.</strong> Prepaid value encourages repeat visits and
            builds stronger customer relationships over time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-extrabold text-center">Grow Through the Network</h2>
          <p className="leading-8">
            <strong>Attract values-driven customers.</strong> Choose a charity to support with your
            transaction fees. Customers know their spending contributes to something meaningful.
          </p>
          <p className="leading-8">
            <strong>Have a voice in the system.</strong> You’re not just a participant—you help
            shape the network. Support and influence representatives who guide governance and key
            decisions.
          </p>
          <p className="leading-8">
            <strong>Keep value moving locally.</strong> Instead of losing margin to extractive
            payment rails, you can participate in a system built to keep value circulating among
            nearby customers, charities, and businesses.
          </p>
        </section>

        <section className="space-y-4 pb-2">
          <h2 className="font-extrabold text-center">Simple to Start</h2>
          <p className="leading-8">
            <strong>Join a merchant network.</strong> Accept vouchers from other businesses and use
            what you earn to spend within the network. It’s like exchanging value with other
            merchants—no middleman, no friction.
          </p>
          <p className="leading-8">
            <strong>Start with the basics.</strong> No complex setup. Mint vouchers, accept
            payments, and start participating right away. The first step is to log in, sign up as
            an individual. Then go to the Merchant Signup Page and let us know about where you are
            and what you sell.
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
