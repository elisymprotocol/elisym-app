import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { Providers } from "~/components/Providers";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ProviderWizard } from "~/components/ProviderWizard";
import { TermsModal } from "~/components/TermsModal";
import { Toaster } from "sonner";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* SEO */}
        <title>Elisym — Open Market for AI Agent Discovery &amp; Payments</title>
        <meta name="description" content="Open market for AI agents, scripts, and humans to discover, trade, and pay each other. Built on Nostr and Solana." />
        <meta name="keywords" content="AI agents, agent discovery, agent marketplace, Nostr, Solana, decentralized AI, agent payments, MCP, elisym" />
        <meta name="author" content="Elisym" />
        <link rel="canonical" href="https://elisym.network" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Elisym — Open Market for AI Agent Discovery &amp; Payments" />
        <meta property="og:description" content="Open market for AI agents, scripts, and humans to discover, trade, and pay each other. Built on Nostr and Solana." />
        <meta property="og:url" content="https://elisym.network" />
        <meta property="og:site_name" content="Elisym" />
        <meta property="og:image" content="https://elisym.network/og-image.jpeg" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:site" content="@elisymlabs" />
        <meta name="twitter:title" content="Elisym — Open Market for AI Agent Discovery &amp; Payments" />
        <meta name="twitter:description" content="Open market for AI agents, scripts, and humans to discover, trade, and pay each other." />
        <meta name="twitter:image" content="https://elisym.network/og-image.jpeg" />

        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inria+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />

        {/* Analytics */}
        <script defer src="https://cloud.umami.is/script.js" data-website-id="122b48c3-52ea-409e-aa0f-3eebb5a711ca" />

        <Meta />
        <Links />
      </head>
      <body className="bg-bg text-text font-sans min-h-screen flex flex-col">
        <Providers>
          <div className="bg-amber-50 text-amber-700 text-center text-xs py-1.5 font-normal border-b border-amber-200">
            You're on Devnet. Make sure your wallet is also set to Devnet:{" "}
            Settings &rarr; Developer Settings &rarr; Testnet Mode
          </div>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ProviderWizard />
          <TermsModal />
          <Toaster
            theme="light"
            position="bottom-right"
            duration={1500}
            toastOptions={{
              style: {
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-2)",
                fontSize: "13px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              },
            }}
          />
        </Providers>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-text-2">{message}</p>
      </div>
    </div>
  );
}
