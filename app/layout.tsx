import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/ui/navbar";
import { Footer } from "@/components/ui/footer";
import { PWARegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Nutri Snap — Estimasi Kalori & Makro dari Foto",
    template: "%s | Nutri Snap",
  },
  description:
    "Unggah foto makanan untuk memperkirakan kalori dan makro secara otomatis. Sesuaikan porsi, target personal, dan dapatkan ringkasan singkat.",
  applicationName: "Nutri Snap",
  keywords: [
    "nutrisi",
    "kalori",
    "makro",
    "diet",
    "kesehatan",
    "food tracking",
    "AI nutrition",
    "Next.js",
  ],
  authors: [{ name: "Derajatul" }],
  creator: "Derajatul",
  publisher: "Derajatul",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: baseUrl,
    siteName: "Nutri Snap",
    title: "Nutri Snap — Estimasi Kalori & Makro dari Foto",
    description:
      "Unggah foto makanan untuk memperkirakan kalori dan makro secara otomatis. Sesuaikan porsi, target personal, dan dapatkan ringkasan singkat.",
    images: [
      {
        url: "/globe.svg",
        width: 1200,
        height: 630,
        alt: "Nutri Snap",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nutri Snap — Estimasi Kalori & Makro dari Foto",
    description:
      "Unggah foto makanan untuk memperkirakan kalori dan makro secara otomatis.",
    images: ["/globe.svg"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: ["/favicon.svg"],
    apple: ["/icon-192.png"],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        <PWARegister />
        <div className="min-h-[calc(100dvh-56px-64px)]">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
