"use client";
import Link from "next/link";
import { LandingHeader } from "@tcoin/wallet/components/landing-header";

export default function ResourcesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black text-foreground text-base">
      <LandingHeader />
      <main className="flex-grow pt-40 px-6 max-w-screen-xl mx-auto lg:w-3/5 space-y-8 bg-white dark:bg-black">
        <h1 className="font-extrabold text-center my-5">Resources</h1>
        <p>
          <strong>DoraHack BUDIL:</strong>{" "}
          <Link href="https://dorahacks.io/buidl/14336" target="_blank">
            Find out more about the details of the project by checking out this hackathon submission.
          </Link>
        </p>
        <p>
          <strong>Whitepaper:</strong>{" "}
          <Link href="https://docs.google.com/document/d/1eHSfW12Cw7HGznSpMBFJf7TGMOx6uFSatYO2t-ezYtU/edit?tab=t.6am3ekffscmi#heading=h.9j36dhj3y2db" target="_blank">
            The background to this project can be found in this Whitepaper, authored by N Lindqvist. Note: We keep adding to the whitepaper appendices during the hackathon.
          </Link>
        </p>
        <p>
          <strong>Presentation:</strong>{" "}
          <Link href="https://drive.google.com/file/d/103zZDnQPfKmaLjxnSBB0B-K7vsCYoazw/view" target="_blank">
            We presented the project to a Toronto audience on Aug 15. Check out the presentation here.
          </Link>
        </p>
        <p>
          <strong>Source Code:</strong>{" "}
          <Link href="https://github.com/GreenPill-TO/TorontoCoin" target="_blank">
            The source code for this project is of course fully open and auditable.
          </Link>
        </p>
        <p>
          <Link href="/">Return home</Link>
        </p>
      </main>
    </div>
  );
}
