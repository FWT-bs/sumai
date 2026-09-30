import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sumai",
  description:
    "Import UW class schedules, share one join code, and see the hours your whole group has open.",
  applicationName: "Sumai",
  appleWebApp: { capable: true, title: "Sumai", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#131120" },
  ],
};

/** Applies a stored theme choice before first paint so the page never flashes
 *  the wrong palette. Absent a choice, the OS setting decides. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("sumai.theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
