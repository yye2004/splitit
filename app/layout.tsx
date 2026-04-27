import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitLah",
  description: "A sketchbook-style bill splitting prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
