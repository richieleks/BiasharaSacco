import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { PieChart, Users, Wallet, HandCoins, Receipt, BarChart3, UserCheck, Settings, HelpCircle } from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: PieChart,
  },
  {
    name: "Members",
    href: "/members",
    icon: Users,
  },
  {
    name: "Savings",
    href: "/savings",
    icon: Wallet,
  },
  {
    name: "Loans",
    href: "/loans",
    icon: HandCoins,
  },
  {
    name: "Transactions",
    href: "/transactions",
    icon: Receipt,
  },
  {
    name: "Guarantors",
    href: "/guarantors", 
    icon: UserCheck,
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
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

  return (
    <aside className="hidden lg:block w-64 bg-white shadow-sm h-screen sticky top-16 border-r border-slate-200">
      <nav className="p-4 space-y-2">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      isActive ? "text-primary-600" : "text-slate-400 group-hover:text-slate-500"
                    )}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-4 mt-4">
          <div className="space-y-1">
            {secondaryNavigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 transition-colors",
                        isActive ? "text-primary-600" : "text-slate-400 group-hover:text-slate-500"
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
