import React, { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const MotionWrapButton = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`inline-block ${className}`}>
    {children}
  </motion.div>
);

interface SiteHeaderProps {
  variant?: "home" | "standard";
}

const navLinks = [
  { label: "Find a Dealer", href: "/find" },
  { label: "Dealers", href: "/dealers" },
  { label: "Warranty Service", href: "/warranty" },
  { label: "Order", href: "/order", primary: true },
];

const homeLinks = [
  { label: "Features", href: "#features" },
  { label: "Specs", href: "#specs" },
  { label: "Gallery", href: "#gallery" },
];

export default function SiteHeader({ variant = "standard" }: SiteHeaderProps) {
  const { scrollY } = useScroll();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navShadow = useTransform(scrollY, [0, 50], ["none", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setMobileOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: "-100%" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ boxShadow: navShadow }}
      className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5"
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="font-display font-bold text-2xl tracking-wider text-primary drop-shadow-sm cursor-pointer" onClick={() => window.location.href = '/'}>
          DUBDUB22
        </div>
        {variant === "home" && (
          <div className="hidden md:flex gap-8 font-sans text-sm font-medium text-muted-foreground">
            {homeLinks.map(link => (
              <button key={link.href} onClick={() => scrollToSection(link.href.slice(1))} className="group relative hover:text-primary transition-colors py-1">
                {link.label.toUpperCase()}
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary transition-all duration-300 group-hover:w-full"></span>
              </button>
            ))}
          </div>
        )}
        <div className="hidden sm:flex gap-3">
          {navLinks.map(link => (
            <MotionWrapButton key={link.href}>
              <Button
                variant={link.primary ? "default" : "outline"}
                className={`${link.primary ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg" : "border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"} font-display uppercase tracking-wide cursor-pointer`}
                onClick={() => window.location.href = link.href}
              >
                {link.label}
              </Button>
            </MotionWrapButton>
          ))}
        </div>
        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:hidden bg-background/95 backdrop-blur-md border-b border-white/5 px-6 py-4 space-y-2"
        >
          {variant === "home" && homeLinks.map(link => (
            <button
              key={link.href}
              onClick={() => scrollToSection(link.href.slice(1))}
              className="block w-full text-left py-2 text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label.toUpperCase()}
            </button>
          ))}
          {navLinks.map(link => (
            <button
              key={link.href}
              onClick={() => { window.location.href = link.href; setMobileOpen(false); }}
              className={`block w-full text-left py-2 font-display uppercase tracking-wide ${link.primary ? "text-primary font-bold" : "text-muted-foreground hover:text-primary"} transition-colors`}
            >
              {link.label}
            </button>
          ))}
        </motion.div>
      )}
    </motion.nav>
  );
}
