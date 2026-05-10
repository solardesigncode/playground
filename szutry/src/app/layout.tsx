import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "szutry.cc — mapa szutrów premium i asfaltów S-tier",
  description:
    "Społecznościowa mapa najlepszych szutrów i asfaltów do jazdy na rowerze.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
