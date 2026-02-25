import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BASeD · Email Intelligence",
  description: "Email intelligence surfaced by your agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
