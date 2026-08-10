import { Link, useLocation } from "wouter";
import { Brain, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";

export function NavBar() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-foreground group-hover:text-primary transition-colors">
              MindPulse<span className="text-primary">.ai</span>
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-2 sm:gap-6">
            <Link 
              href="/" 
              className={`relative px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                location === "/" ? "text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              {location === "/" && (
                <motion.div 
                  layoutId="nav-pill" 
                  className="absolute inset-0 bg-white/10 rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Detect</span>
              </span>
            </Link>

            <Link 
              href="/dashboard" 
              className={`relative px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                location === "/dashboard" ? "text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              {location === "/dashboard" && (
                <motion.div 
                  layoutId="nav-pill" 
                  className="absolute inset-0 bg-white/10 rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
