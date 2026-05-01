import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { PublicSettingsProvider, usePublicSettings } from "@/lib/publicSettings";
import { GlobalErrorProvider, useGlobalError } from "./contexts/globalError";
import { UpgradeModal } from "./components/modals/UpgradeModal";
import { ApiError } from "@workspace/api-client-react";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";

import { AuthGuard } from "./components/layout/AuthGuard";
import { AppLayout } from "./components/layout/AppLayout";
import { FeatureGuard } from "./components/layout/FeatureGuard";
import { UpgradePrompt } from "./components/layout/UpgradePrompt";

import { AuthProvider } from "./contexts/auth";
import { useMemo, useState, useRef, useEffect } from "react";

import Login from "./pages/login";
import Register from "./pages/register";
import VerifyEmail from "./pages/verify-email";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import NotFound from "./pages/not-found";

import Dashboard from "./pages/dashboard";
import History from "./pages/history";
import Templates from "./pages/templates";
import Keys from "./pages/Keys";
import TelegramBot from "./pages/bot";

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
import PointsPage from "./pages/points";
import Help from "./pages/help";
import Profile from "./pages/profile";
import Tickets from "./pages/tickets";
import AdminTickets from "./pages/admin-tickets";


function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AuthGuard>
      <AppLayout>
        <Component />
      </AppLayout>
    </AuthGuard>
  );
}

// ── Wrapper Components to avoid anonymous arrow functions in Route ─────────────

const KeysPage = () => (
  <FeatureGuard
    feature="has_api_access"
    fallback={
      <UpgradePrompt 
        requiredPlan="business" 
        title="API Access Required"
      />
    }
  >
    <Keys />
  </FeatureGuard>
);

const SitesPage = () => (
  <FeatureGuard
    feature="has_blog_automation"
    fallback={<UpgradePrompt requiredPlan="pro" title="Blog Automation Locked" />}
  >
    <Sites />
  </FeatureGuard>
);

const ArticlesPage = () => (
  <FeatureGuard
    feature="has_blog_automation"
    fallback={<UpgradePrompt requiredPlan="pro" title="Articles Locked" />}
  >
    <Articles />
  </FeatureGuard>
);

const PipelinePage = () => (
  <FeatureGuard
    feature="has_blog_automation"
    fallback={<UpgradePrompt requiredPlan="pro" title="Pipeline Automation Locked" />}
  >
    <Pipeline />
  </FeatureGuard>
);

const LogsPage = () => (
  <FeatureGuard
    feature="has_blog_automation"
    fallback={<UpgradePrompt requiredPlan="pro" title="Logs & History Locked" />}
  >
    <Logs />
  </FeatureGuard>
);

const RssFeedsPage = () => (
  <FeatureGuard
    feature="has_blog_automation"
    title="RSS Feeds Locked"
    description="Set up automatic polling for your favorite news sources to feed your blog."
  >
    <RssFeeds />
  </FeatureGuard>
);

const SiteDetailPageWrapper = () => (
  <AuthGuard>
    <AppLayout>
      <SiteDetail />
    </AppLayout>
  </AuthGuard>
);

function Router() {
  return (
    <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/generate"><Redirect to="/template-builder" /></Route>
      <Route path="/history"><ProtectedRoute component={History} /></Route>
      <Route path="/templates"><ProtectedRoute component={Templates} /></Route>
      <Route path="/keys"><ProtectedRoute component={KeysPage} /></Route>
      <Route path="/telegram"><ProtectedRoute component={TelegramBot} /></Route>
      <Route path="/subscription"><Redirect to="/billing" /></Route>
      <Route path="/template-builder"><ProtectedRoute component={TemplateBuilder} /></Route>
      <Route path="/admin"><ProtectedRoute component={BlogAdmin} /></Route>

      <Route path="/sites/:id/agents" component={SiteDetailPageWrapper} />
      <Route path="/sites/:id" component={SiteDetailPageWrapper} />
      <Route path="/sites"><ProtectedRoute component={SitesPage} /></Route>
      <Route path="/articles"><ProtectedRoute component={ArticlesPage} /></Route>
      <Route path="/pipeline"><ProtectedRoute component={PipelinePage} /></Route>
      <Route path="/logs"><ProtectedRoute component={LogsPage} /></Route>
      <Route path="/billing"><ProtectedRoute component={Billing} /></Route>
      <Route path="/blog-admin"><ProtectedRoute component={BlogAdmin} /></Route>
      <Route path="/rss-feeds"><ProtectedRoute component={RssFeedsPage} /></Route>
      <Route path="/admin/tickets"><ProtectedRoute component={AdminTickets} /></Route>
      <Route path="/blog-admin/tickets"><ProtectedRoute component={AdminTickets} /></Route>
      <Route path="/points"><ProtectedRoute component={PointsPage} /></Route>
      <Route path="/help"><ProtectedRoute component={Help} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      <Route path="/tickets"><ProtectedRoute component={Tickets} /></Route>

      <Route path="/landing" component={Landing} />
      <Route path="/" component={Landing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function handleGlobalError(error: unknown, openUpgradeModal: (payload: any) => void) {
  if (error instanceof ApiError) {
    const data = error.data as any;
    const code = data?.code ?? data?.error;

    if (error.status === 403 && code === "FEATURE_DISABLED") {
      openUpgradeModal({
        feature: data.feature,
        requiredPlan: data.requiredPlan,
        currentPlan: data.currentPlan,
        message: data.message,
        upgradeUrl: data.upgradeUrl || "/billing",
      });
    }
  }
}

function AppInner() {
  const { googleClientId } = usePublicSettings();
  const { openUpgradeModal } = useGlobalError();

  const openUpgradeModalRef = useRef(openUpgradeModal);
  useEffect(() => {
    openUpgradeModalRef.current = openUpgradeModal;
  }, [openUpgradeModal]);

  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => handleGlobalError(error, openUpgradeModalRef.current),
    }),
    mutationCache: new MutationCache({
      onError: (error) => handleGlobalError(error, openUpgradeModalRef.current),
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={googleClientId || "placeholder"}>
        <AuthProvider>
          <TooltipProvider>
            <ErrorBoundary>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
            </ErrorBoundary>
            <Toaster />
            <UpgradeModal />
          </TooltipProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <PublicSettingsProvider>
      <GlobalErrorProvider>
        <AppInner />
      </GlobalErrorProvider>
    </PublicSettingsProvider>
  );
}

export default App;
