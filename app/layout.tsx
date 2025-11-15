import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "GitChat Journal - Your Daily GitHub Journal",
  description: "A GitHub-themed daily conversational chatbot journaling system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col bg-github-dark">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}

