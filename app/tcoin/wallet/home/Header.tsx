// app/tcoin/wallet/home/Header.tsx
import React from 'react';
import Link from 'next/link';

const Header: React.FC = () => {
  return (
    <header className="bg-blue-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo or Site Title */}
        <h1 className="text-3xl font-bold">
          <Link href="/">Toronto Coin (T-Coin)</Link>
        </h1>

        {/* Navigation Menu */}
        <nav className="flex items-center">
          <Link href="#learn-more" className="px-3 py-2 rounded hover:bg-blue-700">
            Learn More
          </Link>
          <Link href="#contact" className="ml-4 px-3 py-2 rounded hover:bg-blue-700">
            Contact Us
          </Link>
          <Link
            href="/demo"
            className="ml-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-full"
          >
            Demo App
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
