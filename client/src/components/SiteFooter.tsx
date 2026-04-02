import React from "react";
import { Phone, Mail, ExternalLink } from "lucide-react";

const complianceLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Shipping Policy", href: "/shipping" },
  { label: "Returns & Restocking", href: "/returns" },
  { label: "In The Wild", href: "/in-the-wild" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-card border-t border-white/10 pt-12 pb-8">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Left: Brand */}
          <div>
            <div className="font-display font-bold text-2xl tracking-wider text-primary mb-1">
              DUBDUB22
            </div>
            <p className="text-xs text-muted-foreground">A product of Double T Tactical</p>
          </div>

          {/* Center: Compliance Pages */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-widest text-foreground mb-4">
              Legal
            </h3>
            <ul className="space-y-2">
              {complianceLinks.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors text-sm flex items-center gap-1"
                  >
                    {link.label}
                    <ExternalLink size={10} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Contact Info */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-widest text-foreground mb-4">
              Contact
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-primary" />
                <a href="tel:+14693078001" className="hover:text-primary transition-colors">
                  469-307-8001
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-primary" />
                <a href="mailto:sales@doublettactical.com" className="hover:text-primary transition-colors">
                  sales@doublettactical.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-primary" />
                <a href="mailto:info@dubdub22.com" className="hover:text-primary transition-colors">
                  info@dubdub22.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DUBDUB LLC &mdash; Floresville, TX
          </p>
          <p className="text-xs text-muted-foreground">
            dubdub22.com
          </p>
        </div>
      </div>
    </footer>
  );
}
