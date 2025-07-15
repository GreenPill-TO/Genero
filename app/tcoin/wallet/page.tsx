'use client';
import { Card, CardContent, CardHeader } from "@shared/components/ui/Card";
import { Fade } from "react-awesome-reveal";
import "@tcoin/wallet/styles/home.scss";

export default function HomePage() {
  return (
    <main className="p-4 sm:px-20 md:px-32 lg:px-40 sm:text-xl home-screen">
      <header className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary my-4 sm:my-8">
          TORONTO COIN
        </h1>
        <h2 className="text-foreground text-lg md:text-xl font-medium">
          Local Currency, Global Example
        </h2>
        <p className="italic">A project by Toronto DAO</p>
      </header>

      <section className="space-y-8">
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>The future of money is local</CardHeader>
            <CardContent>
              <p>
                Toronto Coin (T-Coin) is a new kind of currency—one rooted in the
                rhythms of city life. Designed to keep money circulating in
                Toronto, every T-Coin transaction supports your neighbourhood,
                your favourite local spot, and the causes you care about.
              </p>
              <p>It’s not just money. It’s a movement.</p>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>Why T-Coin?</CardHeader>
            <CardContent>
              <ul className="list-disc ml-6 space-y-2">
                <li>
                  <strong>Built for Toronto</strong> – T-Coin is pegged to the
                  price of a TTC fare, so it holds its value in the way that
                  matters most: getting around the city.
                </li>
                <li>
                  <strong>Support your community</strong> – 3% of each
                  transaction goes to a local nonprofit of your choice. No
                  middlemen. No billion-dollar processors.
                </li>
                <li>
                  <strong>Spend or share</strong> – Use T-Coin to pay in stores,
                  tip your server, or give directly to someone in need—QR codes
                  make it effortless.
                </li>
                <li>
                  <strong>Circulation over accumulation</strong> – A small
                  monthly demurrage fee (1%) encourages money to keep moving, not
                  sit idle.
                </li>
              </ul>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>How It Works</CardHeader>
            <CardContent>
              <ul className="list-disc ml-6 space-y-2">
                <li>
                  <strong>Digital Wallets</strong>
                  <br />A user-friendly app for sending and receiving T-Coins—
                  secure, transparent, and designed to feel familiar.
                </li>
                <li>
                  <strong>Physical tBills</strong>
                  <br />Durable polymer notes with RFID chips. Use them just like
                  cash, with added smart features like balance checks and expiry
                  reminders.
                </li>
                <li>
                  <strong>Charity by default</strong>
                  <br />Every time you spend T-Coins, 3% is minted for a local
                  cause. Choose your charity once in the app—it happens
                  automatically.
                </li>
                <li>
                  <strong>QR Codes Everywhere</strong>
                  <br />Panhandlers, artists, waitstaff—anyone can receive
                  T-Coins with a simple QR. And stores can post a fixed amount
                  for instant payment.
                </li>
              </ul>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>A Currency Designed for Real Life</CardHeader>
            <CardContent>
              <ul className="list-disc ml-6 space-y-2">
                <li>
                  <strong>Stable and sensible</strong> – By tying the coin’s
                  value to TTC fares, it remains relevant and stable—even as the
                  Canadian dollar fluctuates.
                </li>
                <li>
                  <strong>Transparent and fair</strong> – You already pay 3% in
                  credit card fees. With T-Coin, that same 3% becomes a donation
                  to your city.
                </li>
                <li>
                  <strong>Local by design</strong> – Our goal is to keep money
                  moving locally—supporting shops, schools, and social services.
                </li>
              </ul>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>Not Just Money—Infrastructure</CardHeader>
            <CardContent>
              <ul className="list-disc ml-6 space-y-2">
                <li>
                  <strong>A system that serves all</strong>
                  <br />From digital wallets to tBills, every part of the T-Coin
                  ecosystem is designed to be inclusive—no bank account required.
                </li>
                <li>
                  <strong>Price stability, done right</strong>
                  <br />No artificial scarcity. T-Coins are minted on demand,
                  with supply managed to meet community needs—not speculative
                  interests.
                </li>
                <li>
                  <strong>Participatory governance</strong>
                  <br />Toronto DAO oversees the treasury, sets rules, and adapts
                  to community feedback. Decisions are made transparently and
                  with purpose.
                </li>
              </ul>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>Who’s Behind This?</CardHeader>
            <CardContent>
              <p>
                Toronto Coin is a project by{' '}
                <a href="link" target="_blank" rel="noopener noreferrer">
                  Toronto DAO (TDAO)
                </a>
                , with co-sponsorship from{' '}
                <a href="link" target="_blank" rel="noopener noreferrer">
                  GreenPill.TO
                </a>
                . Inspired by the Wörgl Experiment, Silvio Gesell, and the
                Chiemgauer model, we’re creating a real-world currency backed by
                open-source code, local values, and practical economics.
              </p>
              <p>We believe money should work for people—not the other way around.</p>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>How to Get Involved</CardHeader>
            <CardContent>
              <ul className="list-disc ml-6 space-y-2">
                <li>
                  <strong>Sign up</strong> –{' '}
                  <a href="link" target="_blank" rel="noopener noreferrer">
                    Join the mailing list
                  </a>{' '}
                  and get early access to buy T-Coins.
                </li>
                <li>
                  <strong>Help build it</strong> – We’re a grassroots team.{' '}
                  <a href="link" target="_blank" rel="noopener noreferrer">
                    Message us on WhatsApp
                  </a>
                  .
                </li>
                <li>
                  <strong>Explore the details</strong> –{' '}
                  <a href="link" target="_blank" rel="noopener noreferrer">
                    Read the whitepaper
                  </a>
                  ,{' '}
                  <a href="link" target="_blank" rel="noopener noreferrer">
                    check out the presentation
                  </a>
                  , and{' '}
                  <a href="link" target="_blank" rel="noopener noreferrer">
                    see the source code
                  </a>
                  .
                </li>
                <li>
                  <strong>Try it out</strong> – (Coming soon) Buy T-Coins and
                  support a stronger, more resilient Toronto.
                </li>
              </ul>
            </CardContent>
          </Card>
        </Fade>

        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>What Are You Waiting For?</CardHeader>
            <CardContent>
              <p>
                <strong>T-Coin is a statement, a system, and a tool.</strong>
                <br />It’s what happens when we reimagine money as a way to
                build—not extract—from our communities.
              </p>
              <p>Toronto doesn’t just deserve a better currency. We’re building one.</p>
            </CardContent>
          </Card>
        </Fade>
      </section>
    </main>
  );
}
