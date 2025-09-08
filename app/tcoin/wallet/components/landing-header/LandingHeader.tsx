"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full bg-background text-foreground z-50 shadow-none border-none">
      <div className="flex items-center justify-between md:grid md:grid-cols-3 lg:[grid-template-columns:30%_40%_30%] pb-1">
        <div className="flex-1 px-4 md:px-6 md:col-start-2">
          <Image
            src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-light-mode.png"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="w-full dark:hidden"
            priority
          />
          <Image
            src="https://osgpkjqbdbybbmhrfxnw.supabase.co/storage/v1/object/public/website-images/tcoin-banner-dark-mode.png"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="hidden w-full dark:block"
            priority
          />
          <p className="hidden md:block text-right mb-2">
            Local Currency. Value = $3.35. Proceeds to charity.
          </p>
        </div>
        <nav className="hidden md:flex items-center justify-start px-6">
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-[#05656F] text-white dark:bg-white dark:text-black no-underline"
          >
            &lt;open my wallet&gt;
          </Link>
        </nav>
        <div className="flex md:hidden items-center justify-end px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-[#05656F] dark:text-primary" />
          </button>
        </div>
      </div>

      <div
        className={`fixed top-0 right-0 h-full w-2/3 bg-background text-foreground z-50 transform transition-transform duration-300 p-6 flex flex-col space-y-4 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="self-end mb-4"
        >
          <X className="h-6 w-6 text-[#05656F] dark:text-primary" />
        </button>
        <p>Local Currency.</p>
        <p>Value = $3.35.</p>
        <p>Proceeds to charity.</p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-[#05656F] text-white dark:bg-white dark:text-black no-underline mt-4"
        >
          &lt;open my wallet&gt;
        </Link>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}
    </header>
  );
}
