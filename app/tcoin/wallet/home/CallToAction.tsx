// app/tcoin/wallet/home/CallToAction.tsx
import React from 'react';

const CallToAction: React.FC = () => {
  return (
    <section className="bg-blue-800 text-center text-white py-16">
      <h2 className="text-4xl font-bold mb-4">What are you waiting for?</h2>
      <p className="text-xl mb-8">Join the movement and be part of a more equitable, vibrant, and sustainable Toronto.</p>
      <a href="#contact" className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-6 rounded-full">
        Sign Up
      </a>
    </section>
  );
};

export default CallToAction;
