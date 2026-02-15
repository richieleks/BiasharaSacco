import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, PiggyBank, HandCoins, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export default function MetricsGrid() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000,
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

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUpRight className="h-3 w-3" />;
    if (change < 0) return <ArrowDownRight className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-slate-500";
  };

  const formatChange = (change: string) => {
    const val = parseFloat(change || '0');
    if (val > 0) return `+${val}%`;
    if (val < 0) return `${val}%`;
    return "0%";
  };

  const metricCards = [
    {
      title: "Total Members",
      value: (metrics.totalMembers || 0).toLocaleString(),
      icon: Users,
      color: "bg-primary-100 text-primary-600",
      change: metrics.memberChange || '0',
      subtitle: `${metrics.newMembersThisMonth || 0} new this month`,
    },
    {
      title: "Total Savings",
      value: `UGX ${parseFloat(metrics.totalSavings || "0").toLocaleString()}`,
      icon: PiggyBank,
      color: "bg-green-100 text-green-600",
      change: metrics.savingsChange || '0',
      subtitle: "Active accounts balance",
    },
    {
      title: "Active Loans",
      value: `UGX ${parseFloat(metrics.activeLoans || "0").toLocaleString()}`,
      icon: HandCoins,
      color: "bg-yellow-100 text-yellow-600",
      change: metrics.loansChange || '0',
      subtitle: `${metrics.pendingLoans || 0} pending approval`,
    },
    {
      title: "Repayment Rate",
      value: `${metrics.repaymentRate || "0"}%`,
      icon: TrendingUp,
      color: "bg-green-100 text-green-600",
      change: metrics.repaymentChange || '0',
      subtitle: `${metrics.totalTransactionsThisMonth || 0} transactions this month`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metricCards.map((metric, index) => {
        const changeVal = parseFloat(metric.change || '0');
        return (
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
              <div className="flex items-center justify-between mt-4">
                <div className={`flex items-center gap-1 text-sm font-medium ${getChangeColor(changeVal)}`}>
                  {getChangeIcon(changeVal)}
                  <span>{formatChange(metric.change)}</span>
                  <span className="text-slate-500 font-normal ml-1">vs last month</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">{metric.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
