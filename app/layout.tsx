import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DetailFlow",
  description: "Autókozmetikai vállalkozásod saját munkaterülete.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/detailflow.svg",
    shortcut: "/detailflow.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
