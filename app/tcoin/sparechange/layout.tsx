import { ModalProvider } from "@shared/contexts/ModalContext";
import DarkModeProvider from "@shared/providers/dark-mode-provider";
import { ReactQueryProvider } from "@shared/providers/react-query-provider";
import "@tcoin/sparechange/styles/app.scss";
import type { Metadata } from "next";
import ContentLayout from "./ContentLayout";

export const metadata: Metadata = {
  title: "Spare Change",
  description: "Help people donate to Panhandlers, Waitresses and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <DarkModeProvider>
            <ModalProvider>
              <ContentLayout>{children}</ContentLayout>
            </ModalProvider>
          </DarkModeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
