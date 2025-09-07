"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <div className="min-h-screen flex flex-col bg-white text-gray-800 text-base">
        <header className="fixed top-0 left-0 w-full bg-white z-50 shadow-none border-none">
          <div className="sm:hidden flex items-start justify-between pb-1 px-6">
            <Image
              src="https://cspyqrxxyflnuwzzzkmv.supabase.co/storage/v1/object/public/website-images/tcoin-banner.png"
              alt="Toronto Coin banner"
              width={1920}
              height={600}
              className="flex-grow"
              priority
            />
            <button
              type="button"
              className="ml-2 p-2"
              onClick={() => setMenuOpen(true)}
            >
              <span className="sr-only">Menu</span>
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
          <div className="hidden sm:grid grid-cols-3 lg:[grid-template-columns:30%_40%_30%] items-start pb-1">
            <div />
            <div className="px-6">
              <Image
                src="https://cspyqrxxyflnuwzzzkmv.supabase.co/storage/v1/object/public/website-images/tcoin-banner.png"
                alt="Toronto Coin banner"
                width={1920}
                height={600}
                className="w-full"
                priority
              />
              <p className="text-right mb-2">
                Local Currency. Value = $3.35. Proceeds to charity.
              </p>
            </div>
            <nav className="flex items-start justify-start px-6">
              <Link href="/dashboard" className="no-underline">
                &lt;open my wallet&gt;
              </Link>
            </nav>
          </div>
        </header>
        {menuOpen && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <button
              type="button"
              className="fixed inset-0 h-full w-full bg-black/50"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="fixed top-0 right-0 h-full w-2/3 bg-white text-black shadow-lg p-6 flex flex-col space-y-4">
              <button
                type="button"
                className="self-end mb-4"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <p>Local Currency.</p>
              <p>Value = $3.35.</p>
              <p>Proceeds to charity.</p>
              <Link href="/dashboard" className="no-underline mt-auto">
                &lt;open my wallet&gt;
              </Link>
            </div>
          </div>
        )}
        <main className="flex-grow">

        <section id="future" className="pt-72 px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">The future of money is local</h2>
          <p className="mb-2">
            <span className="bg-gray-200 px-1">
              Toronto Coin (TCOIN) is a new kind of currency - one rooted in the
              rhythms of city life.
            </span>{" "}
            Designed to keep money circulating in Toronto, every TCOIN
            transaction supports your neighbourhood, your favourite local spot,
            and the causes you care about.
          </p>
          <p>It’s not just money. It’s a movement.</p>
        </section>

        <section id="why" className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">Why TCOIN?</h2>
          <div className="space-y-4">
            <p>
              <span className="bg-gray-200 px-1">Built for Toronto.</span> TCOIN
              is pegged to the price of a TTC fare, so it holds its value in the
              way that matters most: getting around the city.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Support your community.</span>{" "}
              3% of each transaction goes to a local nonprofit of your choice. No
              middlemen. No billion-dollar processors.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Spend or share.</span> Use
              TCOIN to pay in stores, tip your server, or give directly to
              someone in need - QR codes make it effortless.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Circulation over accumulation.</span>
              A small monthly demurrage fee (1%) encourages money to keep moving,
              not sit idle.
            </p>
          </div>
        </section>

        <section id="how" className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">How It Works</h2>
          <p className="mb-2">
            TCOIN combines the best of digital and physical payment systems:
          </p>
          <div className="space-y-4">
            <p>
              <span className="bg-gray-200 px-1">Digital Wallets.</span> A
              user-friendly app for sending and receiving TCOINs - secure,
              transparent, and designed to feel familiar.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Physical tBills.</span> Durable
              polymer notes with RFID chips. Use them just like cash, with added
              smart features like balance checks and expiry reminders.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Charity by default.</span> Every
              time you spend TCOINs, 3% is minted for a local cause. Choose your
              charity once in the app - it happens automatically.
            </p>
            <p>
              <span className="bg-gray-200 px-1">QR Codes Everywhere.</span>
              Panhandlers, artists, waitstaff - anyone can receive TCOINs with a
              simple QR. And stores can post a fixed amount for instant payment.
            </p>
          </div>
        </section>

        <section id="real-life" className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">A Currency Designed for Real Life</h2>
          <p className="mb-2">
            TCOIN is engineered for Toronto’s unique needs:
          </p>
          <div className="space-y-4">
            <p>
              <span className="bg-gray-200 px-1">Stable and sensible.</span> By
              tying the coin’s value to TTC fares, it remains relevant and
              stable - even as the Canadian dollar fluctuates.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Transparent and fair.</span> You
              already pay 3% in credit card fees. With TCOIN, that same 3%
              becomes a donation to your city.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Local by design.</span> Our goal
              is to keep money moving locally - supporting shops, schools, and
              social services.
            </p>
          </div>
        </section>

        <section
          id="infrastructure"
          className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]"
        >
          <h2 className="font-extrabold text-center my-5">Not Just Money - Infrastructure</h2>
          <p className="mb-2">
            Money is a public good. With TCOIN, we’re building infrastructure
            for a fairer economy:
          </p>
          <div className="space-y-4">
            <p>
              <span className="bg-gray-200 px-1">A system that serves all.</span>
              From digital wallets to tBills, every part of the TCOIN ecosystem
              is designed to be inclusive - no bank account required.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Price stability, done right.</span>
              No artificial scarcity. TCOINs are minted on demand, with supply
              managed to meet community needs - not speculative interests.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Participatory governance.</span>
              Toronto DAO oversees the treasury, sets rules, and adapts to
              community feedback. Decisions are made transparently and with
              purpose.
            </p>
          </div>
        </section>

        <section id="who" className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">Who’s Behind This?</h2>
          <p className="mb-2">
            Toronto Coin is a joint project by{' '}
            <Link href="https://www.tdao.to/">Toronto DAO</Link> and{' '}
            <Link href="https://greenpill.to/">GreenPill Toronto</Link>. Inspired
            by the Wörgl Experiment, Silvio Gesell, and the Chiemgauer model,
            we’re creating a real-world currency backed by open-source code,
            local values, and practical economics.
          </p>
          <p>
            We believe money should work for people - not the other way around.
          </p>
        </section>

        <section id="involved" className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">How to Get Involved</h2>
          <div className="space-y-4">
            <p>
              <span className="bg-gray-200 px-1">Sign up.</span>{" "}
              <Link href="link">Join the mailing list</Link> and get early access to buy TCOINs.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Help build it.</span> We’re a grassroots team. <Link href="link">Message us on WhatsApp</Link>.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Spread the word.</span> The greatest help we could get is signing up new stores and service providers willing to accept TCOIN.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Explore the details.</span>{" "}<Link href="link">Read the whitepaper</Link>,{" "}<Link href="link">check out the presentation</Link>, and{" "}<Link href="link">see the source code</Link>.
            </p>
            <p>
              <span className="bg-gray-200 px-1">Try it out.</span> (Coming soon) Buy TCOINs and support a stronger, more resilient Toronto.
            </p>
          </div>
        </section>

        <section className="px-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%]">
          <h2 className="font-extrabold text-center my-5">What Are You Waiting For?</h2>
          <p className="mb-2">
            <span className="bg-gray-200 px-1">
              TCOIN is a statement, a system, and a tool.
            </span>
          </p>
          <p>
            It’s what happens when we reimagine money as a way to build up - not extract from - our communities.
          </p>
          <p className="mt-4">
            Toronto doesn’t just deserve a better currency.
            <br />
            We’re building one.
          </p>
        </section>
      </main>
    </div>
    </>
  );
}
