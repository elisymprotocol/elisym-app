import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { Providers } from "~/components/Providers";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ChatFab } from "~/components/ChatFab";
import { ChatPanel } from "~/components/ChatPanel";
import { ProviderWizard } from "~/components/ProviderWizard";
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
          <ChatFab />
          <ChatPanel />
          <ProviderWizard />
          <Toaster theme="dark" position="bottom-right" />
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
