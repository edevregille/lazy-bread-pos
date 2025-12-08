import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

import SessionProvider from "./SessionProvider";
import { getServerSession } from "next-auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lazy Bread Console",
  description: "Laxy Bread POS Console"
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="dd-rum-sync"
          src="https://www.datadoghq-browser-agent.com/us1/v6/datadog-rum.js"
          type="text/javascript"
          strategy="beforeInteractive"
        />
        <Script id="datadog-rum">
          {`
            window.DD_RUM && window.DD_RUM.init({
              applicationId: "${process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID || ''}",
              clientToken: "${process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN || ''}",
              site: "datadoghq.com",
              service: "lazy-bread-pos",
              env: "${process.env.NEXT_PUBLIC_DD_ENV || ''}",
              version: "",
              sessionSampleRate: 100,
              sessionReplaySampleRate: 20,
              trackUserInteractions: true,
              trackResources: true,
              trackLongTasks: true,
              defaultPrivacyLevel: "mask-user-input",
            });
          `}
        </Script>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
