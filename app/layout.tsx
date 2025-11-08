import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Assistant - AI-powered Active Recall",
  description: "AI-powered active recall learning app",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Learning Assistant",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
