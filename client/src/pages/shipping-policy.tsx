import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Shipping Policy</h1>

            <div className="space-y-6 text-muted-foreground">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Domestic Shipping</h2>
                <p>
                  All orders are shipped via USPS Priority Mail or UPS Ground. Typical transit time
                  is 2–5 business days depending on your location. A tracking number will be
                  provided via email once your order ships.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">ATF Form 3 Transfers</h2>
                <p>
                  suppressor purchases require an ATF Form 3 transfer through a licensed dealer
                  near you. The purchase process involves coordinating with your chosen dealer to
                  complete the transfer. This typically adds 1–3 weeks to the overall timeline
                  depending on dealer responsiveness and ATF processing.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">International Shipping</h2>
                <p>
                  We do not ship suppressors internationally. Suppressor ownership is regulated
                  by federal law and varies by country. We are unable to fulfill orders outside
                  the United States.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Order Confirmation</h2>
                <p>
                  You will receive an order confirmation email immediately after placing your order.
                  Once your suppressor ships, you will receive a second email with tracking information.
                  If you have questions about your order, reach out to us at{" "}
                  <a href="mailto:orders@dubdub22.com" className="text-primary hover:underline">
                    orders@dubdub22.com
                  </a>
                  .
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Demo Units</h2>
                <p>
                  Demo can orders ship directly to your door via standard shipping. Demo units
                  are available for purchase after you have had a chance to evaluate them.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
