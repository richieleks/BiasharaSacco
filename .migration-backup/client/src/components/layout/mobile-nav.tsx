import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { PieChart, Users, Wallet, HandCoins, BarChart3 } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: PieChart,
    permission: { action: "read", resource: "dashboard" },
  },
  {
    name: "Members",
    href: "/members",
    icon: Users,
    permission: { action: "read", resource: "members" },
  },
  {
    name: "Savings",
    href: "/savings",
    icon: Wallet,
    permission: { action: "read", resource: "savings" },
  },
  {
    name: "Loans",
    href: "/loans",
    icon: HandCoins,
    permission: { action: "read", resource: "loans" },
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: { action: "read", resource: "reports" },
  },
];

export default function MobileNav() {
  const [location] = useLocation();
  const { hasPermission } = useRBAC();

  const visibleNavigation = navigation.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission.action, item.permission.resource);
  });

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-4 py-2 z-40">
      <div className="flex justify-around">
        {visibleNavigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center py-2 px-3 rounded-lg transition-colors cursor-pointer",
                  isActive
                    ? "text-primary-600"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs font-medium mt-1">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
