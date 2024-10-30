// app/tcoin/wallet/home/MainLayout.tsx
import React from 'react';
import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';

const MainLayout: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        {/* Meta tags and other head elements */}
      </Head>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </div>
    </>
  );
};

export default MainLayout;
