// components/home/Features.tsx

import { Card, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/Card";

export function Features() {
  const features = [
    {
      title: "Easy Donations",
      description: "Donate spare change effortlessly.",
      icon: "🪙",
    },
    {
      title: "Secure Payments",
      description: "Your transactions are safe and secure.",
      icon: "🔒",
    },
    {
      title: "Impact Tracking",
      description: "See the impact of your donations in real-time.",
      icon: "📊",
    },
  ];

  return (
    <section id="features" className={"py-12 w-full"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className={`text-3xl font-bold text-center mb-8`}>Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-4 text-center">
              <CardHeader className="p-2 text-4xl">{feature.icon}</CardHeader>
              <CardTitle className="text-xl">{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
