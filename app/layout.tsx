import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Profit Watch",
  description: "Track event and custom bakery order costs, payments, and projected profit.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
