import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Hyppado - Encontre Produtos em alta",
  description:
    "A plataforma que te permite saber antes de todo mundo os melhores produtos em alta e insights precisos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the per-request nonce injected by middleware into the forwarded
  // request headers. Next.js App Router (13.4+) picks this up automatically
  // and adds it to its own inline hydration <script> tags, making the
  // nonce-based CSP work without unsafe-inline for scripts.
  // Calling headers() here also forces dynamic rendering of the root layout,
  // which is required so every request gets its own unique nonce.
  const nonce = headers().get("x-nonce") ?? undefined;
  void nonce; // available to pass as nonce prop to <Script> components if needed
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
