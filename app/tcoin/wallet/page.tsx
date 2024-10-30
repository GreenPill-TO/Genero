// app/tcoin/wallet/page.tsx
import React from 'react';
import MainLayout from './home/MainLayout';
import HeroSection from './home/HeroSection';
import Section from './home/Section';
import CallToAction from './home/CallToAction';

const HomePage: React.FC = () => {
  return (
    <div 
      className="bg-background text-foreground min-h-screen w-full bg-cover bg-center"
      style={{
        backgroundImage: "url('/images/background_blue.jpg')",
      }}
    >
      <MainLayout title="Toronto Coin (T-Coin) – Empowering Toronto’s Economy - this text is not rendered">
        <HeroSection />
        <Section title="What is Toronto Coin - is this text rendered??" id="what-is-tcoin">
          <p>
            Toronto Coin, or T-Coin, is a groundbreaking local currency initiative designed to strengthen Toronto's economy, enhance community engagement,
            and promote sustainable practices...
          </p>
        </Section>
        {/* Add more sections following the same pattern */}
        <CallToAction />
      </MainLayout>
    </div>
  );
};

export default HomePage;
