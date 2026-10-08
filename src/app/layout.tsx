import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "勁丰羽球館｜場地租借預約系統",
  description: "勁丰羽球館線上場地租借預約系統",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
