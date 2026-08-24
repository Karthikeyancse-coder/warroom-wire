import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "War-Room Wire — Real-Time News Intelligence",
  description:
    "Live news aggregation dashboard pulling from GDELT, Reddit, RSS, and Bluesky into one real-time feed. Built for hackathon demos.",
  openGraph: {
    title: "War-Room Wire",
    description: "Real-time crisis-monitoring news aggregation dashboard",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-surface text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
