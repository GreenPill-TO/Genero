import Image from "next/image";
import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 w-full bg-background text-foreground z-50 shadow-none border-none">
      <div className="grid grid-cols-3 lg:[grid-template-columns:30%_40%_30%] items-start pb-1">
        <div />
        <div className="px-6">
          <Image
            src="https://cspyqrxxyflnuwzzzkmv.supabase.co/storage/v1/object/public/website-images/tcoin-banner.png"
            alt="Toronto Coin banner"
            width={1920}
            height={600}
            className="w-full"
            priority
          />
          <p className="text-right mb-2">
            Local Currency. Value = $3.35. Proceeds to charity.
          </p>
        </div>
        <nav className="flex items-start justify-start px-6">
          <Link href="/dashboard" className="no-underline">
            &lt;open my wallet&gt;
          </Link>
        </nav>
      </div>
    </header>
  );
}
