import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaxDox AI — Tax Document Intelligence Platform",
  description:
    "AI-native tax document intelligence platform. Make tax document processing as simple as sending an email. PBC list management, AI extraction, and tax software integration for accounting firms.",
  keywords: [
    "TaxDox AI",
    "tax document",
    "PBC list",
    "AI extraction",
    "accounting",
    "CPA",
    "tax software",
  ],
  authors: [{ name: "TaxDox AI" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TaxDox AI — Tax Document Intelligence Platform",
    description:
      "Make tax document processing as simple as sending an email.",
    siteName: "TaxDox AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
