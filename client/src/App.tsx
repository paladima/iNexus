import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Skeleton } from "@/components/ui/skeleton";

// Eager-load the home page for fast initial render
import Home from "./pages/Home";

// Lazy-load all other pages (#18: reduce initial bundle)
const Discover = lazy(() => import("./pages/Discover"));
const People = lazy(() => import("./pages/People"));
const PersonProfile = lazy(() => import("./pages/PersonProfile"));
const Lists = lazy(() => import("./pages/Lists"));
const ListDetail = lazy(() => import("./pages/ListDetail"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Drafts = lazy(() => import("./pages/Drafts"));
const ActivityPage = lazy(() => import("./pages/Activity"));
const Voice = lazy(() => import("./pages/Voice"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}

function Router() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/discover" component={Discover} />
          <Route path="/people" component={People} />
          <Route path="/people/:id" component={PersonProfile} />
          <Route path="/lists" component={Lists} />
          <Route path="/lists/:id" component={ListDetail} />
          <Route path="/opportunities" component={Opportunities} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/drafts" component={Drafts} />
          <Route path="/activity" component={ActivityPage} />
          <Route path="/voice" component={Voice} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
