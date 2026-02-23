import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Meta Ads Dashboard | Static Shift",
  description: "Ad performance dashboard for all Static Shift clients",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen">
          <header
            className="sticky top-0 z-50"
            style={{
              background: "var(--color-bg)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  SS
                </div>
                <span className="font-semibold text-sm tracking-tight">
                  Meta Ads Dashboard
                </span>
              </div>
              <div
                className="flex items-center gap-4 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                <span>Static Shift</span>
              </div>
            </div>
          </header>
          <main className="max-w-[1440px] mx-auto px-6 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
