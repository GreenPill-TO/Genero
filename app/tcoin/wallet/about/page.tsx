'use client';
import React, { useEffect } from "react";
import { Card, CardContent, CardHeader } from "@shared/components/ui/Card";
import { cn } from "@shared/utils/classnames";
import { Fade } from "react-awesome-reveal";
import "@tcoin/wallet/styles/home.scss";

const TCoinApp = () => {
  useEffect(() => {
    // Access the URL search params using the browser's window API
    const queryParams = new URLSearchParams(window.location.search);
    const pay = queryParams.get("pay");

    if (pay) {
      // Redirect using window.location.replace to avoid creating an extra history entry
      window.location.replace(`/dashboard?pay=${pay}`);
    }
    const invoice = queryParams.get("invoice");

    if(invoice){
      window.location.replace(`/dashboard?invoice=${invoice}`);
    }
  }, []);

  return (
    <main className="p-4 sm:px-20 md:px-32 lg:px-40 sm:text-xl home-screen">
      <header className="mb-8 text-center">
        <h1
          className={cn(
            "text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary",
            "my-4 sm:my-8"
          )}
        >
          Toronto Coin (T-Coin)
        </h1>
        <h3 className="text-white font-bold mb-4">
          Empowering Toronto&apos;s Economy
        </h3>
      </header>

      <section className="space-y-8">
        {/* Summary */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card className="sm:!mb-12 md:!mb-16 lg:!mb-20">
            <CardContent>
              <p>Summary:</p>
              <ul className="list-disc ml-6 sm:ml-8">
                <li>
                  Automatically share 3% of transaction value to a local charity of your own choice (not to the credit card industry).
                </li>
                <li>Keep money circulating locally (not to foreign suppliers).</li>
                <li>
                  Also an easy way to tip your waitress in person and to donate to panhandlers with QR codes.
                </li>
                <li>Local money is better money.</li>
              </ul>
            </CardContent>
          </Card>
        </Fade>

        {/* What is Toronto Coin? */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>What is Toronto Coin?</span>
            </CardHeader>
            <CardContent>
              <p>
                Toronto Coin, or T-Coin, is a groundbreaking local currency initiative designed to
                strengthen Toronto&apos;s economy, enhance community engagement, and promote
                sustainable practices. T-Coin is a modern, blockchain-based currency that combines the
                benefits of digital and physical money to keep value circulating within our local
                community. By using T-Coin, you&apos;re not just making a transaction—you&apos;re
                supporting local businesses, contributing to local charities, and participating in a more
                equitable and sustainable economic system.
              </p>
              <p>This is a temporary website until we find the time to build a proper one.</p>
            </CardContent>
          </Card>
        </Fade>

        {/* How Does T-Coin Work? */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>How Does T-Coin Work?</span>
            </CardHeader>
            <CardContent>
              <p>
                <strong>
                  Supporting local businesses, fostering community engagement, and building a sustainable Toronto economy.
                </strong>
              </p>
              <p>
                <strong>Digital Wallets and Blockchain:</strong> T-Coin operates on a secure blockchain
                ledger, ensuring transparency and security for all transactions. Users manage their
                T-Coins through a user-friendly digital wallet app, making payments as simple as a tap
                on your smartphone.
              </p>
              <p>
                <strong>Physical tBills:</strong> For those who prefer physical currency, T-Coin also
                offers tBills—plastic bills embedded with RFID technology. These tBills are available in
                various denominations and can be used just like cash, with the added benefit of easy
                verification through the T-Coin app.
              </p>
              <p>
                <strong>Community and Charity:</strong> Each time you purchase T-Coins, 3% of your
                transaction is directly donated to a local charity of your choice. This makes every
                transaction not just a personal benefit but a contribution to the community.
              </p>
              <p>
                <strong>QR-based payments:</strong> Paying someone is easy. Panhandlers will have a
                personal QR code you can scan and send any amount to. Waitresses will have a QR code to
                which you select a percentage as a tip. Stores can easily create a QR code with a
                specific amount for you to scan and pay.
              </p>
              <p>
                <strong>
                  Real Price Stability, Value Pegged to TTC:
                </strong>{" "}
                T-Coin&apos;s value is pegged to the cost of a full fare on the Toronto Transit
                Commission (TTC), ensuring stability and practical value in everyday transactions.
                Currently priced at $3.30, but when Metrolinx increases the price to $3.40 or $3.50 (?)
                then the value of your T-Coin will also increase. This provides price stability better than
                the Canadian Dollar, and ensures it remains relevant and good for practical use in everyday
                transactions.
              </p>
              <p>
                <strong>3% Transaction Fees:</strong> You already pay 3% to credit cards like Visa and
                Mastercard. Well, the store pays the 3% and keeps 97%. T-Coin will also charge the same 3%
                fee from stores, but in this case the money goes directly to a local charity instead of an
                anonymous financial behemoth. And it&apos;s a charity of your own choice. Just set it up
                once in the T-Coin app and then 3% will be routed to them for every transaction you make.
              </p>
              <p>
                <strong>Demurrage:</strong> &quot;Coins are round because they should roll.&quot;
                Velocity of money is good for society. Our way of contributing is by introducing a 1%
                &quot;demurrage&quot; per month, which is another name for &quot;negative interest rate&quot;.
                At the end of each month you&apos;ll see the amount of T-Coin in your wallet reduced by 1%.
                This acts as an incentive for you to spend your T-Coin, to the benefit of your local community,
                rather than hoarding them.
              </p>
            </CardContent>
          </Card>
        </Fade>

        {/* Broad Potential for Use Cases */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>Broad Potential for Use Cases</span>
            </CardHeader>
            <CardContent>
              <p>
                <strong>Re-democratizing the Monetary System with T-Coin</strong>
              </p>
              <p>
                T-Coin&apos;s versatility allows it to be used in a wide range of scenarios, making it an
                integral part of Toronto&apos;s local economy:
              </p>
              <p>
                <strong>Fundraising for Schools:</strong> Schools can organize fundraising events where
                donations are made in T-Coins, ensuring that the contributions stay within the community and
                support local education.
              </p>
              <p>
                <strong>Donations to Local Charities or Panhandlers:</strong> Easily donate to your favorite
                local charity or even help someone in need directly with T-Coins, knowing that your donation
                is secure, trackable, and beneficial to the community. Learn more at{" "}
                <a
                  href="https://sparechange.tips"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  sparechange.tips
                </a>
                .
              </p>
              <p>
                <strong>Shopping at Local Stores:</strong> Use T-Coins to pay for goods and services at
                participating local businesses. Instead of transaction fees going to big corporations like Visa
                and Mastercard, 3% of your purchase value is donated to local charities, amplifying the
                positive impact of your shopping.
              </p>
            </CardContent>
          </Card>
        </Fade>

        {/* Why Use T-Coin? */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>Why Use T-Coin?</span>
            </CardHeader>
            <CardContent>
              <p>
                <strong>Support Local Businesses:</strong> T-Coin is designed to keep money circulating
                within Toronto, helping local businesses thrive in the face of competition from large
                corporations and online retailers.
              </p>
              <p>
                <strong>Promote Sustainability:</strong> T-Coin encourages environmentally and socially
                responsible practices by incentivizing local spending and supporting sustainable community
                projects.
              </p>
              <p>
                <strong>Financial Inclusion:</strong> T-Coin offers an accessible alternative to
                traditional financial systems, especially for those who may be underserved by conventional
                banking.
              </p>
              <p>
                <strong>Strengthen the Community:</strong> By using T-Coin, you&apos;re helping to build a
                more resilient and connected Toronto, where every transaction benefits your neighbors and
                local causes.
              </p>
            </CardContent>
          </Card>
        </Fade>

        {/* Learn More & Get Involved */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>Learn More &amp; Get Involved</span>
            </CardHeader>
            <CardContent>
              <p>
                <strong>DoraHack BUDIL:</strong> Find out more about the details of the project by checking
                out this hackathon submission.{" "}
                <a
                  href="https://dorahacks.io/buidl/14336"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Link
                </a>
              </p>
              <p>
                <strong>Whitepaper:</strong> The background to this project can be found in this
                Whitepaper, authored by N Lindqvist. Note: We keep adding to the whitepaper appendices during
                the hackathon.{" "}
                <a
                  href="https://docs.google.com/document/d/1eHSfW12Cw7HGznSpMBFJf7TGMOx6uFSatYO2t-ezYtU/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Link
                </a>
              </p>
              <p>
                <strong>Presentation:</strong> We presented the project to a Toronto audience on Aug 15.
                Check out the presentation here:{" "}
                <a
                  href="https://drive.google.com/file/d/103zZDnQPfKmaLjxnSBB0B-K7vsCYoazw/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Link
                </a>
              </p>
              <p>
                <strong>Source Code:</strong> The source code for this project is of course fully open and
                auditable.{" "}
                <a
                  href="https://github.com/GreenPill-TO/TorontoCoin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Link
                </a>
              </p>
              <p>
                <strong>Get in Touch? Help out?</strong> We want to hear from you. We&apos;re a small and
                friendly team and would love your input, insights and any help you can offer.{" "}
                <a
                  href="https://chat.whatsapp.com/EXF4AkkksYA0fY26nQhrTv"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </p>
            </CardContent>
          </Card>
        </Fade>

        {/* About Our Sponsor Organisations */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>About Our Sponsor Organisations</span>
            </CardHeader>
            <CardContent>
              <p>
                <strong>
                  <a href="https://tdao.to/" target="_blank" rel="noopener noreferrer">
                    Toronto DAO (TDAO):
                  </a>
                </strong>{" "}
                The driving force behind T-Coin, inspired by the economic theories of Silvio Gesell and the
                successful Wörgl Experiment. TDAO aims to create a resilient and inclusive economic ecosystem in
                Toronto by leveraging innovative blockchain technology and community-focused strategies.{" "}
                <a href="https://tdao.to/" target="_blank" rel="noopener noreferrer">
                  Link
                </a>
              </p>
              <p>
                <strong>
                  <a href="https://greenpill.to/" target="_blank" rel="noopener noreferrer">
                    GreenPill.TO:
                  </a>
                </strong>{" "}
                A co-sponsor of the T-Coin project, focusing on sustainable economic practices and social
                responsibility. GreenPill TO works to ensure that every aspect of T-Coin contributes positively
                to the environment and society, aligning with broader goals of sustainability and ethical
                economic growth.{" "}
                <a href="https://greenpill.to/" target="_blank" rel="noopener noreferrer">
                  Link
                </a>
              </p>
            </CardContent>
          </Card>
        </Fade>

        {/* What are you waiting for? */}
        <Fade triggerOnce direction="up" duration={800}>
          <Card>
            <CardHeader>
              <span>What are you waiting for?</span>
            </CardHeader>
            <CardContent>
              <p>
                <a
                  href="https://forms.gle/vtqzeJ17fRhxW9BP8"
                  className="text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join the Movement: Be part of a more equitable, vibrant, and sustainable Toronto.
                </a>
              </p>
              <p>Buy T-Coin: (Coming soon.)</p>
              <p>
                <a
                  href="https://forms.gle/vtqzeJ17fRhxW9BP8"
                  className="text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sign up: Get the newsletter. Be in the know. Get early access to buy T-Coin.
                </a>
              </p>
            </CardContent>
          </Card>
        </Fade>
      </section>
    </main>
  );
};

export default TCoinApp;