import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { PieChart, Users, Wallet, HandCoins, Receipt, BarChart3, UserCheck, Settings, HelpCircle } from "lucide-react";
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
    name: "Transactions",
    href: "/transactions",
    icon: Receipt,
    permission: { action: "read", resource: "transactions" },
  },
  {
    name: "Guarantors",
    href: "/guarantors", 
    icon: UserCheck,
    permission: { action: "read", resource: "guarantors" },
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: { action: "read", resource: "reports" },
  },
];

const secondaryNavigation = [
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    name: "Support",
    href: "/support",
    icon: HelpCircle,
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { hasPermission } = useRBAC();

  const visibleNavigation = navigation.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission.action, item.permission.resource);
  });

  return (
    <aside className="hidden lg:block w-64 bg-white dark:bg-slate-900 shadow-sm h-screen sticky top-16 border-r border-slate-200 dark:border-slate-700">
      <nav className="p-4 space-y-2">
        <div className="space-y-1">
          {visibleNavigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      isActive ? "text-primary-600" : "text-slate-400 dark:text-slate-400 group-hover:text-slate-500 dark:text-slate-400 dark:group-hover:text-slate-300"
                    )}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
          <div className="space-y-1">
            {secondaryNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 transition-colors",
                        isActive ? "text-primary-600" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:text-slate-400"
                      )}
                    />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
