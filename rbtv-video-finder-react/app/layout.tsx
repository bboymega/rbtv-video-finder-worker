import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

config.autoAddCss = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#f8f9fa",
};

export const metadata: Metadata = {
  title: "RBTV Video Finder",
  description: "Search for your favorite clip with adrenaline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      style={{ scrollbarGutter: 'stable'}}
    >
      <body className="min-h-screen bg-light flex flex-col m-0 p-0 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}