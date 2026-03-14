import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import People from "./pages/People";
import PersonProfile from "./pages/PersonProfile";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import Opportunities from "./pages/Opportunities";
import Tasks from "./pages/Tasks";
import Drafts from "./pages/Drafts";
import ActivityPage from "./pages/Activity";
import Voice from "./pages/Voice";
import SettingsPage from "./pages/Settings";
import NotFound from "@/pages/NotFound";

function Router() {
  return (
    <DashboardLayout>
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
