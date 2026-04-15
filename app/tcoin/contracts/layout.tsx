"use client";

import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ModalProvider } from "@shared/contexts/ModalContext";
import Link from "next/link";
import "@tcoin/contracts/styles/app.scss";

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <DarkModeProvider>
            <ModalProvider>
              <div className="contracts-shell">
                <header className="contracts-header">
                  <div className="brand">TCOIN Contract Management</div>
                  <nav>
                    <Link href="/">Home</Link>
                    <Link href="/governance">Governance</Link>
                    <Link href="/city-manager">City Manager</Link>
                    <Link href="/stewards">Stewards</Link>
                    <Link href="/charity-operator">Charity</Link>
                    <Link href="/treasury">Treasury</Link>
                    <Link href="/token-admin">Token Admin</Link>
                    <Link href="/registry">Registry</Link>
                  </nav>
                </header>
                <main className="contracts-main">{children}</main>
              </div>
            </ModalProvider>
          </DarkModeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
