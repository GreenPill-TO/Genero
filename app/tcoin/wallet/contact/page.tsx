"use client";
import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto lg:w-2/5 lg:mx-[30%] space-y-4">
      <h1 className="font-extrabold text-center my-5">Contact</h1>
      <p>If you have questions about TCOIN or want to get involved, send us an email at <a href="mailto:hello@tcoin.me">hello@tcoin.me</a>.</p>
      <p>
        <Link href="/">Return home</Link>
      </p>
    </div>
  );
}
