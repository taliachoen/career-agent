import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CareerAgent",
  description: "AI-powered career and job matching platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans text-[15px] sm:text-base">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
