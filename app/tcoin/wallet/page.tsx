// app/tcoin/wallet/page.tsx
import React from 'react';
import MainLayout from './home/MainLayout';
import HeroSection from './home/HeroSection';
import Section from './home/Section';
import CallToAction from './home/CallToAction';

const HomePage: React.FC = () => {
  return (
    <div
      className="bg-cover bg-center min-h-screen w-full"
      style={{
        backgroundImage: "url('/images/background_blue.jpg')",
      }}
    >
      <MainLayout title="Toronto Coin (T-Coin) – Empowering Toronto’s Economy">
        <div className="container mx-auto max-w-5xl p-4 bg-blue-900 bg-opacity-70 rounded-lg"
        style={{ maxWidth: '90%', minWidth: '60%' }}
        >
          <HeroSection />

          {/* Section: What is Toronto Coin? */}
          <Section title="What is Toronto Coin?" id="what-is-tcoin">
            <p>
              Toronto Coin, or T-Coin, is a groundbreaking local currency initiative designed to strengthen Toronto's economy, enhance community engagement, and promote sustainable practices. T-Coin is a modern, blockchain-based currency that combines the benefits of digital and physical money to keep value circulating within our local community. By using T-Coin, you're not just making a transaction—you're supporting local businesses, contributing to local charities, and participating in a more equitable and sustainable economic system.
            </p>
            <p>
              This is a temporary website until we find the time to build a proper one.
            </p>
          </Section>

          {/* Section: How Does T-Coin Work? */}
          <Section title="How Does T-Coin Work?" id="how-it-works">
            <div>
              {/* Content from the original page */}
              {/* ... */}
            </div>
          </Section>

          {/* Add the rest of the sections similarly */}
          {/* Section: Broad Potential for Use Cases */}
          {/* Section: Why Use T-Coin? */}
          {/* Section: Learn More & Get Involved */}
          {/* Section: About Our Sponsor Organisations */}

          {/* Call to Action */}
          <CallToAction />
        </div>
      </MainLayout>
    </div>
  );
};

export default HomePage;
