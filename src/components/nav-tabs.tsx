import { Link, useRouterState } from "@tanstack/react-router";
import { PackageOpen, LayoutDashboard, ListChecks, BarChart3 } from "lucide-react";
import { SignOutButton } from "@/components/auth-gate";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/returns", label: "Returns", icon: ListChecks },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function NavTabs({ actions }: { actions?: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 bg-[#20282f] border-b border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <PackageOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-sm text-white">Returns Tracker</span>
              <span className="hidden sm:inline text-slate-400 text-sm mx-2">·</span>
              <span className="hidden sm:inline text-xs text-slate-400">SKC Digital</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium rounded-md px-3 py-1.5 transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-slate-400 hover:text-white hover:bg-[#232e36]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <div className="w-px h-5 bg-white/10 mx-1" />
          <SignOutButton />
        </div>
      </div>

      {/* Mobile tab row */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 -mt-1 overflow-x-auto">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 whitespace-nowrap transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-slate-400 hover:text-white hover:bg-[#232e36]",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}