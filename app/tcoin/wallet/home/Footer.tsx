// app/tcoin/wallet/home/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-blue-900 text-white text-center p-4">
      <p>&copy; {new Date().getFullYear()} Toronto Coin. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
