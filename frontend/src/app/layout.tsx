import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Unified Workspace",
  description: "통합 워크스페이스 관리 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <div className="flex-1 overflow-auto p-6">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
