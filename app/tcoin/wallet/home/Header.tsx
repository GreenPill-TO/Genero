// app/tcoin/wallet/home/Header.tsx
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-blue-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo or Site Title */}
        <h1 className="text-3xl font-bold">
          <a href="/tcoin/wallet">Toronto Coin (T-Coin)</a>
        </h1>

        {/* Navigation Menu */}
        <nav className="flex items-center">
          <a href="#learn-more" className="px-3 py-2 rounded hover:bg-blue-700">
            Learn More
          </a>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLScCH-eDSyA6-oYu8MwPCSib-l1YLa-2m3_oODIXRYq5LeJfaQ/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 px-3 py-2 rounded hover:bg-blue-700"
          >
            Contact Us
          </a>
          <a
            href="/demo"
            className="ml-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-full"
          >
            Demo App
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
