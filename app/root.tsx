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
        <Meta />
        <Links />
      </head>
      <body className="bg-bg text-text font-sans min-h-screen flex flex-col">
        <Providers>
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
