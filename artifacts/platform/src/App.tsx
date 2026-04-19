import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { PublicSettingsProvider, usePublicSettings } from "@/lib/publicSettings";

import { AuthGuard } from "./components/layout/AuthGuard";
import { AppLayout } from "./components/layout/AppLayout";

import Login from "./pages/login";
import Register from "./pages/register";
import VerifyEmail from "./pages/verify-email";
import NotFound from "./pages/not-found";

import Dashboard from "./pages/dashboard";
import Generate from "./pages/generate";
import History from "./pages/history";
import Templates from "./pages/templates";
import Keys from "./pages/Keys";
import TelegramBot from "./pages/bot";
import Subscription from "./pages/subscription";
import Admin from "./pages/admin";
import TemplateBuilder from "./pages/template-builder";

import Sites from "./pages/sites";
import { Articles } from "./pages/articles";
import { Pipeline } from "./pages/pipeline";
import { Logs } from "./pages/logs";
import SiteDetail from "./pages/site-detail";
import { Billing } from "./pages/billing";
import { BlogAdmin } from "./pages/blog-admin";
import Landing from "./pages/landing";
import RssFeeds from "./pages/rss-feeds";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AuthGuard>
      <AppLayout>
        <Component />
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={VerifyEmail} />

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/generate"><ProtectedRoute component={Generate} /></Route>
      <Route path="/history"><ProtectedRoute component={History} /></Route>
      <Route path="/templates"><ProtectedRoute component={Templates} /></Route>
      <Route path="/keys"><ProtectedRoute component={Keys} /></Route>
      <Route path="/telegram"><ProtectedRoute component={TelegramBot} /></Route>
      <Route path="/subscription"><ProtectedRoute component={Subscription} /></Route>
      <Route path="/template-builder"><ProtectedRoute component={TemplateBuilder} /></Route>
      <Route path="/admin"><Redirect to="/blog-admin" /></Route>

      <Route path="/sites/:id/agents">
        {() => (
          <AuthGuard>
            <AppLayout>
              <SiteDetail />
            </AppLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/sites/:id">
        {() => (
          <AuthGuard>
            <AppLayout>
              <SiteDetail />
            </AppLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/sites"><ProtectedRoute component={Sites} /></Route>
      <Route path="/articles"><ProtectedRoute component={Articles} /></Route>
      <Route path="/pipeline"><ProtectedRoute component={Pipeline} /></Route>
      <Route path="/logs"><ProtectedRoute component={Logs} /></Route>
      <Route path="/billing"><ProtectedRoute component={Billing} /></Route>
      <Route path="/blog-admin"><ProtectedRoute component={BlogAdmin} /></Route>
      <Route path="/rss-feeds"><ProtectedRoute component={RssFeeds} /></Route>

      <Route path="/landing" component={Landing} />
      <Route path="/"><Redirect to="/dashboard" /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { googleClientId } = usePublicSettings();
  return (
    <GoogleOAuthProvider clientId={googleClientId || "placeholder"}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

function App() {
  return (
    <PublicSettingsProvider>
      <AppInner />
    </PublicSettingsProvider>
  );
}

export default App;
