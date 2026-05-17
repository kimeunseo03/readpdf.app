import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Registry PDF Reader",
  description: "회사 내부용 등본 PDF 판독 MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
