"use client";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur z-50">
        <nav className="max-w-screen-xl mx-auto flex justify-between items-center py-4 px-6">
          <div className="font-bold">TCOIN.ME</div>
          <ul className="flex gap-6 text-sm font-medium">
            <li>
              <a href="#why">Why T-Coin</a>
            </li>
            <li>
              <a href="#how">How It Works</a>
            </li>
            <li>
              <a href="#infrastructure">Infrastructure</a>
            </li>
            <li>
              <a href="#involved">Get Involved</a>
            </li>
          </ul>
        </nav>
      </header>
      <main className="flex-grow">
        <section className="h-screen flex flex-col justify-center px-6 max-w-screen-xl mx-auto">
          <h1 className="text-5xl font-semibold leading-tight mt-20">
            TORONTO COIN
          </h1>
          <p className="mt-4 inline-block bg-gray-100 px-2">
            Local Currency, Global Example
          </p>
          <p className="italic">A project by Toronto DAO</p>
        </section>

        <section id="future" className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">
            The future of money is local
          </h2>
          <p className="mb-4">
            Toronto Coin (T-Coin) is a new kind of currency—one rooted in the
            rhythms of city life. Designed to keep money circulating in Toronto,
            every T-Coin transaction supports your neighbourhood, your favourite
            local spot, and the causes you care about.
          </p>
          <p>It’s not just money. It’s a movement.</p>
        </section>

        <section id="why" className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">Why T-Coin?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="bg-gray-100 px-1">Built for Toronto</span> –
              T-Coin is pegged to the price of a TTC fare, so it holds its value
              in the way that matters most: getting around the city.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Support your community</span> –
              3% of each transaction goes to a local nonprofit of your choice.
              No middlemen. No billion-dollar processors.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Spend or share</span> – Use
              T-Coin to pay in stores, tip your server, or give directly to
              someone in need—QR codes make it effortless.
            </li>
            <li>
              <span className="bg-gray-100 px-1">
                Circulation over accumulation
              </span>{" "}
              – A small monthly demurrage fee (1%) encourages money to keep
              moving, not sit idle.
            </li>
          </ul>
        </section>

        <section id="how" className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">How It Works</h2>
          <p className="mb-4">
            T-Coin combines the best of digital and physical payment systems:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="bg-gray-100 px-1">Digital Wallets</span>
              <div>
                A user-friendly app for sending and receiving T-Coins—secure,
                transparent, and designed to feel familiar.
              </div>
            </li>
            <li>
              <span className="bg-gray-100 px-1">Physical tBills</span>
              <div>
                Durable polymer notes with RFID chips. Use them just like cash,
                with added smart features like balance checks and expiry
                reminders.
              </div>
            </li>
            <li>
              <span className="bg-gray-100 px-1">Charity by default</span>
              <div>
                Every time you spend T-Coins, 3% is minted for a local cause.
                Choose your charity once in the app—it happens automatically.
              </div>
            </li>
            <li>
              <span className="bg-gray-100 px-1">QR Codes Everywhere</span>
              <div>
                Panhandlers, artists, waitstaff—anyone can receive T-Coins with
                a simple QR. And stores can post a fixed amount for instant
                payment.
              </div>
            </li>
          </ul>
        </section>

        <section id="real-life" className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">
            A Currency Designed for Real Life
          </h2>
          <p className="mb-4">
            T-Coin is engineered for Toronto’s unique needs:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="bg-gray-100 px-1">Stable and sensible</span> – By
              tying the coin’s value to TTC fares, it remains relevant and
              stable—even as the Canadian dollar fluctuates.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Transparent and fair</span> –
              You already pay 3% in credit card fees. With T-Coin, that same 3%
              becomes a donation to your city.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Local by design</span> – Our
              goal is to keep money moving locally—supporting shops, schools,
              and social services.
            </li>
          </ul>
        </section>

        <section
          id="infrastructure"
          className="py-16 px-6 max-w-screen-xl mx-auto"
        >
          <h2 className="text-3xl font-semibold mb-4">
            Not Just Money—Infrastructure
          </h2>
          <p className="mb-4">
            Money is a public good. With T-Coin, we’re building infrastructure
            for a fairer economy:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="bg-gray-100 px-1">A system that serves all</span>
              <div>
                From digital wallets to tBills, every part of the T-Coin
                ecosystem is designed to be inclusive—no bank account required.
              </div>
            </li>
            <li>
              <span className="bg-gray-100 px-1">
                Price stability, done right
              </span>
              <div>
                No artificial scarcity. T-Coins are minted on demand, with
                supply managed to meet community needs—not speculative
                interests.
              </div>
            </li>
            <li>
              <span className="bg-gray-100 px-1">Participatory governance</span>
              <div>
                Toronto DAO oversees the treasury, sets rules, and adapts to
                community feedback. Decisions are made transparently and with
                purpose.
              </div>
            </li>
          </ul>
        </section>

        <section id="who" className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">Who’s Behind This?</h2>
          <p className="mb-4">
            Toronto Coin is a project by{" "}
            <Link href="link">Toronto DAO (TDAO)</Link>, with co-sponsorship
            from <Link href="link">GreenPill.TO</Link>. Inspired by the Wörgl
            Experiment, Silvio Gesell, and the Chiemgauer model, we’re creating
            a real-world currency backed by open-source code, local values, and
            practical economics.
          </p>
          <p>
            We believe money should work for people—not the other way around.
          </p>
        </section>

        <section id="involved" className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">How to Get Involved</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="bg-gray-100 px-1">Sign up</span> –{" "}
              <Link href="link">Join the mailing list</Link> and get early
              access to buy T-Coins.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Help build it</span> – We’re a
              grassroots team. <Link href="link">Message us on WhatsApp</Link>.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Explore the details</span> –{" "}
              <Link href="link">Read the whitepaper</Link>,{" "}
              <Link href="link">check out the presentation</Link>, and{" "}
              <Link href="link">see the source code</Link>.
            </li>
            <li>
              <span className="bg-gray-100 px-1">Try it out</span> – (Coming
              soon) Buy T-Coins and support a stronger, more resilient Toronto.
            </li>
          </ul>
        </section>

        <section className="py-16 px-6 max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-semibold mb-4">
            What Are You Waiting For?
          </h2>
          <p className="mb-4">
            <span className="bg-gray-100 px-1">
              T-Coin is a statement, a system, and a tool.
            </span>
          </p>
          <p>
            It’s what happens when we reimagine money as a way to build—not
            extract—from our communities.
          </p>
          <p className="mt-4">
            Toronto doesn’t just deserve a better currency.
            <br />
            We’re building one.
          </p>
        </section>
      </main>
    </div>
  );
}
