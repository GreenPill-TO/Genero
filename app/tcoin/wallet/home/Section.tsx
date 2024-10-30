// app/tcoin/wallet/home/Section.tsx
import React from 'react';

interface SectionProps {
  id?: string;
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ id, title, children }) => {
  return (
    <section id={id} className="container mx-auto py-12 px-4">
      <h2 className="text-4xl font-bold text-center text-pink-500 mb-8">{title}</h2>
      <div className="text-lg text-gray-200">{children}</div>
    </section>
  );
};

export default Section;
