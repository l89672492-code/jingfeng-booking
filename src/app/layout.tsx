import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "勁丰羽球館｜羽球場地租借預約";
const description =
  "勁丰羽球館提供羽球場地租借、羽球零打與羽球教學服務，位於新北市鶯歌區，提供5面標準PU羽球場。";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s｜勁丰羽球館",
  },
  description,
  applicationName: "勁丰羽球館",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "勁丰羽球館",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#57247f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
