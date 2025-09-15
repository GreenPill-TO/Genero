import type { Metadata } from "next";
import React from "react";
import Link from "next/link";

const baseUrl = "https://tcoin.me";

export const metadata: Metadata = {
  title: "TCOIN Ecosystem",
  description:
    "Explore our interconnected projects across identity, payments, coordination, and regenerative economies.",
  openGraph: {
    title: "TCOIN Ecosystem",
    description:
      "Explore our interconnected projects across identity, payments, coordination, and regenerative economies.",
    type: "website",
    url: `${baseUrl}/ecosystem`,
  },
  twitter: {
    card: "summary_large_image",
    title: "TCOIN Ecosystem",
    description:
      "Explore our interconnected projects across identity, payments, coordination, and regenerative economies.",
  },
  alternates: {
    canonical: `${baseUrl}/ecosystem`,
  },
};

export default function EcosystemPage() {
  const sites = [
    { name: "ChainCrew", url: "https://chaincrew.xyz", desc: "Team up in Crews to manage memberships, events, and community treasuries." },
    { name: "ClearPass", url: "https://clearpass.app", desc: "KYC verification with NFC-enabled passports and driver’s licenses." },
    { name: "Cubid", url: "https://cubid.me", desc: "Privacy-preserving identity layer with proofs and stamps." },
    { name: "EquityFlow", url: "https://equityflow.xyz", desc: "Tools for equity and commitment-sharing among founders and teams." },
    { name: "Firebelly", url: "https://firebelly.xyz", desc: "Innovation studio supporting regenerative and Web3 ventures." },
    { name: "FundLoop", url: "https://fundloop.org", desc: "Collaborative incubator and funding network for early-stage projects." },
    { name: "GreenPill Canada", url: "https://greenpill.ca", desc: "Building local regenerative economies across Canada." },
    { name: "GreenPill Toronto", url: "https://greenpill.to", desc: "Toronto node of the global GreenPill Network." },
    { name: "Procent Foundation", url: "https://procentfoundation.com", desc: "Nonprofit supporting public goods and open innovation." },
    { name: "Safe2Meet", url: "https://safe2meet.me", desc: "Safer in-person meetups for real estate, classifieds, and dating." },
    { name: "SmarTrust", url: "https://smartrust.me", desc: "AI-powered escrow & arbitration for freelancers, agencies, and B2B." },
    { name: "SnapVote", url: "https://snapvote.org", desc: "Fast, trustworthy decision-making and polls for communities." },
    { name: "SpareChange", url: "https://sparechange.tips", desc: "Tip anyone with QR codes and digital micro-payments." },
    { name: "TCOIN", url: "https://tcoin.me", desc: "Toronto’s local community currency pegged to transit tokens." },
    { name: "UBI Finder", url: "https://ubifinder.org", desc: "Global directory of Universal Basic Income projects." },
    { name: "FreeForm", url: "https://usefreeform.com", desc: "Next-gen form builder with voting, branching, and identity options." },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100">
      <div className="max-w-5xl mx-auto py-16 px-6">
        <h1 className="text-4xl font-bold text-center mb-10">
          Our Ecosystem
        </h1>
        <p className="text-center text-lg mb-12">
          Explore the interconnected projects we’re building across identity, payments, coordination, and regenerative economies.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {sites.map((site) => (
            <div key={site.url} className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow hover:shadow-lg transition">
              <h2 className="text-2xl font-semibold mb-2">
                <Link
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {site.name}
                </Link>
              </h2>
              <p>{site.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

