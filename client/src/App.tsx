import ShippingPolicyPage from "@/pages/shipping-policy";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import ReturnsRestockingPage from "@/pages/returns";
import UploadTaxFormPage from "./pages/upload-tax-form";
import DealerLoginPage from "@/pages/dealer-login";
import DealerRegisterPage from "@/pages/dealer-register";
import DealerDashboardPage from "@/pages/dealer-dashboard";
import DealerTaxFormPage from "@/pages/dealer-tax-form";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";

import DealersPage from "@/pages/dealers";
import FindPage from "@/pages/find";
import ApplyPage from "@/pages/apply";
import WarrantyPage from "@/pages/warranty";
import AdminPage from "@/pages/admin";
import OrderPage from "@/pages/order";
import OrderConfirmationPage from "@/pages/order-confirmation";
import OrderReceivedPage from "@/pages/order-received";
import ContactPage from "@/pages/contact";
import InTheWildPage from "@/pages/in-the-wild";
import { Switch, Route } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dealers" component={DealersPage} />
      <Route path="/find" component={FindPage} />
      <Route path="/apply" component={ApplyPage} />
      <Route path="/warranty" component={WarrantyPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/shipping" component={ShippingPolicyPage} />
      <Route path="/returns" component={ReturnsRestockingPage} />
      <Route path="/order" component={OrderPage} />
      <Route path="/order-confirmation" component={OrderConfirmationPage} />
      <Route path="/order-received" component={OrderReceivedPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/dealer/login" component={DealerLoginPage} />
      <Route path="/dealer/register" component={DealerRegisterPage} />
      <Route path="/dealer/dashboard" component={DealerDashboardPage} />
      <Route path="/dealer/tax-form" component={DealerTaxFormPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/in-the-wild" component={InTheWildPage} />
      <Route path="/upload-tax-form" component={UploadTaxFormPage} />
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
