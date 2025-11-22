import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@/components/Footer";
import { MobileBottomPadding } from "@/components/MobileBottomPadding";

export const metadata: Metadata = {
  title: "GitChat Journal - Your Daily GitHub Journal",
  description: "A GitHub-themed daily conversational chatbot journaling system",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/app-icon.png",
    apple: "/icons/app-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
            <MobileBottomPadding />
          </div>
        </Providers>
      </body>
    </html>
  );
}

