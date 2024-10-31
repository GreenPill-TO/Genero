import { Card, CardContent, CardHeader } from "@shared/components/ui/Card";
import { cn } from "@shared/utils/classnames";
import "@toronto/tcoin/styles/home.scss";

const TCoinApp = () => {
  return (
    <div className="p-4 sm:px-20 md:px-32 lg:px-40 sm:text-xl home-screen">
      <h1
        className={cn(
          "text-3xl sm:text-4xl md:text-5xl lg:text-6xl",
          "text-center font-bold text-primary",
          "my-4 sm:my-8"
        )}
      >
        Toronto Coin (T-Coin)
      </h1>
      <h3 className={cn("text-white text-center font-bold mb-4")}>Empowering Toronto's Economy</h3>

      <Card className="sm:!mb-12 md:!mb-16 lg:!mb-20">
        <CardContent>
          <p>Summary:</p>
          <ul className="list-disc ml-6 sm:ml-8">
            <li>
              Automatically share 3% of transaction value to a local charity of your own choice (not to the credit card
              industry).
            </li>
            <li>Keep money circulating locally (not to foreign suppliers).</li>
            <li>Also an easy way to tip your waitress in person and to donate to panhandlers with QR codes.</li>
            <li>Local money is better money.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>What is Toronto Coin?</span>
        </CardHeader>
        <CardContent>
          <p>
            Toronto Coin, or T-Coin, is a groundbreaking local currency initiative designed to strengthen Toronto's
            economy, enhance community engagement, and promote sustainable practices. T-Coin is a modern,
            blockchain-based currency that combines the benefits of digital and physical money to keep value circulating
            within our local community. By using T-Coin, you're not just making a transaction—you're supporting local
            businesses, contributing to local charities, and participating in a more equitable and sustainable economic
            system.
          </p>
          <p>This is a temporary website until we find the time to build a proper one.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>How Does T-Coin Work?</span>
        </CardHeader>
        <CardContent>
          <p>
            <b>
              Supporting local businesses, fostering community engagement, and building a sustainable Toronto economy.
            </b>
          </p>
          <p>
            <b>Digital Wallets and Blockchain:</b>T-Coin operates on a secure blockchain ledger, ensuring transparency
            and security for all transactions. Users manage their T-Coins through a user-friendly digital wallet app,
            making payments as simple as a tap on your smartphone.
          </p>
          <p>
            <b>Physical tBills:</b> For those who prefer physical currency, T-Coin also offers tBills—plastic bills
            embedded with RFID technology. These tBills are available in various denominations and can be used just like
            cash, with the added benefit of easy verification through the T-Coin app.
          </p>
          <p>
            <b>Community and Charity:</b> Each time you purchase T-Coins, 3% of your transaction is directly donated to
            a local charity of your choice. This makes every transaction not just a personal benefit but a contribution
            to the community.
          </p>
          <p>
            <b>QR-based payments:</b> Paying someone is easy. Panhandlers will have a personal QR code you can scan and
            send any amount to. Waitresses will have a QR code to which you select a percentage as a tip. Stores can
            easily create a QR code with a specific amount for you to scan and pay.
          </p>
          <p>
            <b>Real Price Stability, Value Pegged to TTC:</b> T-Coin's value is pegged to the cost of a full fare on the
            Toronto Transit Commission (TTC), ensuring stability and practical value in everyday transactions. Currently
            priced at $3.30, but when Metrolinx increases the price to $3.40 or $3.50 (?) then the value of your T-Coin
            will also increase. This provides price stability better than the Canadian Dollar, and ensures it remains
            relevant and good for practical use in everyday transactions.
          </p>
          <p>
            <b>3% Transaction Fees:</b> You already pay 3% to credit cards like Visa and Mastercard. Well, the store
            pays the 3% and keep 97%. T-Coin will also charge the same 3% fee from stores, but in this case the money
            goes directly to a local charity instead of an anonymous financial behemoth. And it's a charity of your own
            choice. Just set it up once in the T-Coin app and then 3% will be routed to them for every transaction you
            make.
          </p>
          <p>
            <b>Demurrage:</b> "Coins are round because they should roll." Velocity of money is good for society. Our way
            of contributing is by introducing a 1% "demurrage" per month, which is another name for "negative interest
            rate". At the end of each month you'll see the amount of T-Coin in your wallet reduced by 1%. This acts as
            an inventive for you to spend your T-Coin, to the benefit of your local community, rather than hoarding
            them.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>Broad Potential for Use Cases</span>
        </CardHeader>
        <CardContent>
          <p>
            <b>Re-democratizing the Monetary System with T-Coin</b>
          </p>
          <p>
            T-Coin's versatility allows it to be used in a wide range of scenarios, making it an integral part of
            Toronto's local economy:
          </p>
          <p>
            <b>Fundraising for Schools:</b> Schools can organize fundraising events where donations are made in T-Coins,
            ensuring that the contributions stay within the community and support local education.
          </p>
          <p>
            <b>Donations to Local Charities or Panhandlers:</b> Easily donate to your favorite local charity or even
            help someone in need directly with T-Coins, knowing that your donation is secure, trackable, and beneficial
            to the community. Learn more at <a href="sparechange.tips">sparechange.tips</a>.
          </p>
          <p>
            <b>Shopping at Local Stores:</b> Use T-Coins to pay for goods and services at participating local
            businesses. Instead of transaction fees going to big corporations like Visa and Mastercard, 3% of your
            purchase value is donated to local charities, amplifying the positive impact of your shopping.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>Why Use T-Coin?</span>
        </CardHeader>
        <CardContent>
          <p>
            <b>Support Local Businesses:</b> T-Coin is designed to keep money circulating within Toronto, helping local
            businesses thrive in the face of competition from large corporations and online retailers.
          </p>
          <p>
            <b>Promote Sustainability:</b> T-Coin encourages environmentally and socially responsible practices by
            incentivizing local spending and supporting sustainable community projects.
          </p>
          <p>
            <b>Financial Inclusion:</b> T-Coin offers an accessible alternative to traditional financial systems,
            especially for those who may be underserved by conventional banking.
          </p>
          <p>
            <b>Strengthen the Community:</b> By using T-Coin, you're helping to build a more resilient and connected
            Toronto, where every transaction benefits your neighbors and local causes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>Learn More & Get Involved</span>
        </CardHeader>
        <CardContent>
          <p>
            <b>DoraHack BUDIL:</b> Find out more about the details of the project by checking out this hackathon
            submission. <a href="https://dorahacks.io/buidl/14336">Link</a>
          </p>
          <p>
            <b>Whitepaper:</b> The background to this project can be found in this Whitepaper, authored by N Lindqvist.
            Note: We keep adding to the whitepaper appendices during the hackathon.{" "}
            <a href="https://docs.google.com/document/d/1eHSfW12Cw7HGznSpMBFJf7TGMOx6uFSatYO2t-ezYtU/edit?usp=sharing">
              Link
            </a>
          </p>
          <p>
            <b>Presentation:</b> We presented the project to a Toronto audience on Aug 15. Check out the presentation
            here: <a href="https://drive.google.com/file/d/103zZDnQPfKmaLjxnSBB0B-K7vsCYoazw/view?usp=sharing">Link</a>
          </p>
          <p>
            <b>Source Code:</b> The source code for this project is of course fully open and auditable.{" "}
            <a href="https://github.com/GreenPill-TO/TorontoCoin">Link</a>
          </p>
          <p>
            <b>Get in Touch? Help out?</b> We want to hear from you. We're a small and friendly team and we would love
            your input, insights and any help you can offer.{" "}
            <a href="https://chat.whatsapp.com/EXF4AkkksYA0fY26nQhrTv">WhatsApp</a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>About Our Sponsor Organisations</span>
        </CardHeader>
        <CardContent>
          <p>
            <b>
              <a href="https://tdao.to/">Toronto DAO (TDAO):</a>
            </b>{" "}
            The driving force behind T-Coin, inspired by the economic theories of Silvio Gesell and the successful Wörgl
            Experiment. TDAO aims to create a resilient and inclusive economic ecosystem in Toronto by leveraging
            innovative blockchain technology and community-focused strategies. <a href="https://tdao.to/">Link</a>
          </p>
          <p>
            <b>
              <a href="https://greenpill.to/">GreenPill.TO:</a>
            </b>{" "}
            A co-sponsor of the T-Coin project, focusing on sustainable economic practices and social responsibility.
            GreenPill TO works to ensure that every aspect of T-Coin contributes positively to the environment and
            society, aligning with broader goals of sustainability and ethical economic growth.{" "}
            <a href="https://greenpill.to/">Link</a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span>What are you waiting for?</span>
        </CardHeader>
        <CardContent>
          <p>
            <a href="https://forms.gle/vtqzeJ17fRhxW9BP8" className="text-foreground">
              Join the Movement: Be part of a more equitable, vibrant, and sustainable Toronto.
            </a>
          </p>
          <p>Buy T-Coin: (Coming soon.)</p>
          <p>
            <a href="https://forms.gle/vtqzeJ17fRhxW9BP8" className="text-foreground">
              Sign up: Get the newsletter. Be in the know. Get early access to buy T-Coin.
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TCoinApp;
