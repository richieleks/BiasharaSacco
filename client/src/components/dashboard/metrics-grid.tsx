import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, PiggyBank, HandCoins, TrendingUp } from "lucide-react";

export default function MetricsGrid() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-slate-200 rounded w-1/2"></div>
                </div>
                <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
              </div>
              <div className="mt-4">
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const metricCards = [
    {
      title: "Total Members",
      value: metrics.totalMembers?.toLocaleString() || "0",
      icon: Users,
      color: "bg-primary-100 text-primary-600",
      change: "+12.5%",
    },
    {
      title: "Total Savings",
      value: `KSh ${parseFloat(metrics.totalSavings || "0").toLocaleString()}`,
      icon: PiggyBank,
      color: "bg-green-100 text-green-600",
      change: "+8.2%",
    },
    {
      title: "Active Loans",
      value: `KSh ${parseFloat(metrics.activeLoans || "0").toLocaleString()}`,
      icon: HandCoins,
      color: "bg-yellow-100 text-yellow-600",
      change: "+15.3%",
    },
    {
      title: "Repayment Rate",
      value: `${metrics.repaymentRate || "0"}%`,
      icon: TrendingUp,
      color: "bg-green-100 text-green-600",
      change: "+2.1%",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metricCards.map((metric, index) => (
        <Card key={index} className="border border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium">{metric.title}</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{metric.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${metric.color}`}>
                <metric.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="flex items-center mt-4">
              <span className="text-green-600 text-sm font-medium">{metric.change}</span>
              <span className="text-slate-500 text-sm ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
