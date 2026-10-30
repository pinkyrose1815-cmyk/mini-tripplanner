import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미니 트립플래너 · 공주",
  description: "조건만 고르면 공주 하루 코스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
