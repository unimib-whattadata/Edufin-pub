import "~/styles/globals.css";

import { type Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Thasadith } from "next/font/google";
import { Toaster } from "~/app/_components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "AIDA | AIEF",
  description: "AIDA - AIEF Intelligent Digital Assistant",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const thasadith = Thasadith({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-thasadith",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      className={`${thasadith.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
          rel="stylesheet"
        />
      </head>
      <body className="scrollbar-hide bg-aida-canvas text-aida-ink h-dvh">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
