import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "굼톨굼톨 매매일지",
  description: "코스피 현물과 KOSPI200 선물을 함께 기록하고 복기하는 개인용 MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
