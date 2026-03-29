import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";

import DealersPage from "@/pages/dealers";
import ApplyPage from "@/pages/apply";
import WarrantyPage from "@/pages/warranty";
import AdminPage from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dealers" component={DealersPage} />
      <Route path="/apply" component={ApplyPage} />
      <Route path="/warranty" component={WarrantyPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
