import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function ReturnsRestockingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Returns &amp; Restocking Policy</h1>

            <div className="space-y-6 text-muted-foreground">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">No Returns on Suppressors</h2>
                <p>
                  Suppressors are regulated by the ATF and cannot be returned once sold. All
                  suppressor sales are final. Please ensure you have selected the correct
                  configuration before completing your order.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Restocking Fee</h2>
                <p>
                  Due to the regulatory requirements and legal paperwork involved in suppressor
                  transfers, any order that is cancelled after processing will be subject to a
                  10% restocking fee. This covers the cost of the ATF Form 3 transfer and
                  administrative processing.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Demo Units</h2>
                <p>
                  Demo units purchased through our demo program may be returned within 14 days
                  of receipt in original condition. Contact us at{" "}
                  <a href="mailto:orders@dubdub22.com" className="text-primary hover:underline">
                    orders@dubdub22.com
                  </a>{" "}
                  to initiate a demo unit return.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Damaged or Defective Items</h2>
                <p>
                  If your order arrives damaged or you believe you received a defective product,
                  contact us immediately at{" "}
                  <a href="mailto:orders@dubdub22.com" className="text-primary hover:underline">
                    orders@dubdub22.com
                  </a>
                  . We will work with you to resolve the issue under our warranty policy.
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
