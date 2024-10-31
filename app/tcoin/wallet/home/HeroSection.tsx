// app/tcoin/wallet/home/HeroSection.tsx
import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <section className="text-center text-white py-20">
      <div className="container mx-auto">
        <h2 className="text-5xl font-bold mb-4">Empowering Toronto’s Economy</h2>
        <p className="text-xl max-w-2xl mx-auto">
          Automatically share 3% of transaction value to a local charity of your own choice, keep money circulating locally, and easily tip or donate with QR codes. Local money is better money.
        </p>
        <a
          href="#learn-more"
          className="mt-8 inline-block bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-full"
        >
          Learn More
        </a>
      </div>
    </section>
  );
};

export default HeroSection;
