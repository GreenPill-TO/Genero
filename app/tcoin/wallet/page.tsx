"use client";

/**
 * New T-Coin wallet homepage following the minimalist layout inspired by
 * Thinking Machines. The copy is untouched aside from basic HTML formatting.
 */
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-50">
        <nav className="max-w-screen-xl mx-auto flex justify-between items-center py-4 px-6">
          <div className="font-bold">T-Coin</div>
          <ul className="flex gap-6 text-sm font-medium">
            <li>
              <Link href="#why">Why T-Coin</Link>
            </li>
            <li>
              <Link href="#how">How It Works</Link>
            </li>
            <li>
              <Link href="#involved">Get Involved</Link>
            </li>
          </ul>
        </nav>
      </header>
      <main className="pt-16 text-lg text-foreground">
        <section className="h-screen flex flex-col justify-center items-start px-6 max-w-screen-xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-semibold leading-tight text-primary">
            TORONTO COIN
          </h1>
          <p className="mt-4 text-xl">Local Currency, Global Example</p>
          <p className="italic">A project by Toronto DAO</p>
        </section>

        <section id="future" className="bg-gray-50 py-16">
          <div className="max-w-screen-xl mx-auto px-6 space-y-4">
            <h2 className="text-3xl font-semibold">The future of money is local</h2>
            <p>
              Toronto Coin (T-Coin) is a new kind of currency—one rooted in the rhythms of city life. Designed to keep money circulating in Toronto, every T-Coin transaction supports your neighbourhood, your favourite local spot, and the causes you care about.
            </p>
            <p>It’s not just money. It’s a movement.</p>
          </div>
        </section>

        <section id="why" className="py-16">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-3xl font-semibold mb-6">Why T-Coin?</h2>
            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong>Built for Toronto</strong> – T-Coin is pegged to the price of a TTC fare, so it holds its value in the way that matters most: getting around the city.
              </li>
              <li>
                <strong>Support your community</strong> – 3% of each transaction goes to a local nonprofit of your choice. No middlemen. No billion-dollar processors.
              </li>
              <li>
                <strong>Spend or share</strong> – Use T-Coin to pay in stores, tip your server, or give directly to someone in need—QR codes make it effortless.
              </li>
              <li>
                <strong>Circulation over accumulation</strong> – A small monthly demurrage fee (1%) encourages money to keep moving, not sit idle.
              </li>
            </ul>
          </div>
        </section>

        <section id="how" className="bg-gray-50 py-16">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-3xl font-semibold mb-6">How It Works</h2>
            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong>Digital Wallets</strong>
                <br />A user-friendly app for sending and receiving T-Coins—secure, transparent, and designed to feel familiar.
              </li>
              <li>
                <strong>Physical tBills</strong>
                <br />Durable polymer notes with RFID chips. Use them just like cash, with added smart features like balance checks and expiry reminders.
              </li>
              <li>
                <strong>Charity by default</strong>
                <br />Every time you spend T-Coins, 3% is minted for a local cause. Choose your charity once in the app—it happens automatically.
              </li>
              <li>
                <strong>QR Codes Everywhere</strong>
                <br />Panhandlers, artists, waitstaff—anyone can receive T-Coins with a simple QR. And stores can post a fixed amount for instant payment.
              </li>
            </ul>
          </div>
        </section>

        <section id="real-life" className="py-16">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-3xl font-semibold mb-6">A Currency Designed for Real Life</h2>
            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong>Stable and sensible</strong> – By tying the coin’s value to TTC fares, it remains relevant and stable—even as the Canadian dollar fluctuates.
              </li>
              <li>
                <strong>Transparent and fair</strong> – You already pay 3% in credit card fees. With T-Coin, that same 3% becomes a donation to your city.
              </li>
              <li>
                <strong>Local by design</strong> – Our goal is to keep money moving locally—supporting shops, schools, and social services.
              </li>
            </ul>
          </div>
        </section>

        <section id="infrastructure" className="bg-gray-50 py-16">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-3xl font-semibold mb-6">Not Just Money—Infrastructure</h2>
            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong>A system that serves all</strong>
                <br />From digital wallets to tBills, every part of the T-Coin ecosystem is designed to be inclusive—no bank account required.
              </li>
              <li>
                <strong>Price stability, done right</strong>
                <br />No artificial scarcity. T-Coins are minted on demand, with supply managed to meet community needs—not speculative interests.
              </li>
              <li>
                <strong>Participatory governance</strong>
                <br />Toronto DAO oversees the treasury, sets rules, and adapts to community feedback. Decisions are made transparently and with purpose.
              </li>
            </ul>
          </div>
        </section>

        <section id="who" className="py-16">
          <div className="max-w-screen-xl mx-auto px-6 space-y-4">
            <h2 className="text-3xl font-semibold">Who’s Behind This?</h2>
            <p>
              Toronto Coin is a project by <a href="link" target="_blank" rel="noopener noreferrer">Toronto DAO (TDAO)</a>, with co-sponsorship from <a href="link" target="_blank" rel="noopener noreferrer">GreenPill.TO</a>. Inspired by the Wörgl Experiment, Silvio Gesell, and the Chiemgauer model, we’re creating a real-world currency backed by open-source code, local values, and practical economics.
            </p>
            <p>We believe money should work for people—not the other way around.</p>
          </div>
        </section>

        <section id="involved" className="bg-gray-50 py-16">
          <div className="max-w-screen-xl mx-auto px-6">
            <h2 className="text-3xl font-semibold mb-6">How to Get Involved</h2>
            <ul className="list-disc pl-6 space-y-4">
              <li>
                <strong>Sign up</strong> – <a href="link" target="_blank" rel="noopener noreferrer">Join the mailing list</a> and get early access to buy T-Coins.
              </li>
              <li>
                <strong>Help build it</strong> – We’re a grassroots team. <a href="link" target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>.
              </li>
              <li>
                <strong>Explore the details</strong> – <a href="link" target="_blank" rel="noopener noreferrer">Read the whitepaper</a>, <a href="link" target="_blank" rel="noopener noreferrer">check out the presentation</a>, and <a href="link" target="_blank" rel="noopener noreferrer">see the source code</a>.
              </li>
              <li>
                <strong>Try it out</strong> – (Coming soon) Buy T-Coins and support a stronger, more resilient Toronto.
              </li>
            </ul>
          </div>
        </section>

        <section id="waiting" className="py-16">
          <div className="max-w-screen-xl mx-auto px-6 space-y-4 text-center">
            <h2 className="text-3xl font-semibold">What Are You Waiting For?</h2>
            <p>
              <strong>T-Coin is a statement, a system, and a tool.</strong>
              <br />It’s what happens when we reimagine money as a way to build—not extract—from our communities.
            </p>
            <p>Toronto doesn’t just deserve a better currency. We’re building one.</p>
          </div>
        </section>
      </main>
    </>
  );
}
