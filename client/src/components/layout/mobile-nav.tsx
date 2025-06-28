import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { PieChart, Users, Wallet, HandCoins, BarChart3 } from "lucide-react";

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
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
];

export default function MobileNav() {
  const [location] = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 z-40">
      <div className="flex justify-around">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center py-2 px-3 rounded-lg transition-colors cursor-pointer",
                  isActive
                    ? "text-primary-600"
                    : "text-slate-400 hover:text-slate-600"
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
