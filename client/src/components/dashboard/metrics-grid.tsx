import { useQuery } from "@tanstack/react-query";
import { Users, PiggyBank, HandCoins, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export default function MetricsGrid() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-3 bg-slate-100 rounded-full w-3/4 mb-3"></div>
                <div className="h-7 bg-slate-100 rounded-lg w-1/2"></div>
              </div>
              <div className="w-11 h-11 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="mt-4">
              <div className="h-2.5 bg-slate-100 rounded-full w-2/3"></div>
            </div>
          </div>
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
    if (change > 0) return "text-emerald-600 bg-emerald-50";
    if (change < 0) return "text-red-600 bg-red-50";
    return "text-slate-500 bg-slate-50";
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
      gradient: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-50 text-blue-600",
      accentColor: "bg-blue-500",
      change: metrics.memberChange || '0',
      subtitle: `${metrics.newMembersThisMonth || 0} new this month`,
    },
    {
      title: "Total Savings",
      value: `UGX ${parseFloat(metrics.totalSavings || "0").toLocaleString()}`,
      icon: PiggyBank,
      gradient: "from-emerald-500 to-emerald-600",
      iconBg: "bg-emerald-50 text-emerald-600",
      accentColor: "bg-emerald-500",
      change: metrics.savingsChange || '0',
      subtitle: "Active accounts balance",
    },
    {
      title: "Active Loans",
      value: `UGX ${parseFloat(metrics.activeLoans || "0").toLocaleString()}`,
      icon: HandCoins,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-50 text-amber-600",
      accentColor: "bg-amber-500",
      change: metrics.loansChange || '0',
      subtitle: `${metrics.pendingLoans || 0} pending approval`,
    },
    {
      title: "Repayment Rate",
      value: `${metrics.repaymentRate || "0"}%`,
      icon: TrendingUp,
      gradient: "from-violet-500 to-purple-600",
      iconBg: "bg-violet-50 text-violet-600",
      accentColor: "bg-violet-500",
      change: metrics.repaymentChange || '0',
      subtitle: `${metrics.totalTransactionsThisMonth || 0} transactions this month`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-8">
      {metricCards.map((metric, index) => {
        const changeVal = parseFloat(metric.change || '0');
        return (
          <div key={index} className="metric-card group animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl bg-gradient-to-r ${metric.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">{metric.title}</p>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight truncate">{metric.value}</p>
              </div>
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${metric.iconBg} transition-transform group-hover:scale-105 shrink-0 ml-2`}>
                <metric.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-100">
              <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full ${getChangeColor(changeVal)}`}>
                {getChangeIcon(changeVal)}
                <span>{formatChange(metric.change)}</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate ml-1">{metric.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
