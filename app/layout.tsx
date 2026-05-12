import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteHeaderWithUser } from "@/components/site-header-with-user";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "CortePro — Agenda para barbearias",
  description: "Assinatura, agenda e agendamentos online para barbeiros.",
  icons: {
    icon: "/icon",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${display.variable} min-h-screen font-sans`}
      >
        <Providers>
          <SiteHeaderWithUser />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
