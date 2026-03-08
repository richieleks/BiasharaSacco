import { useQuery } from "@tanstack/react-query";
import { 
  PieChart, 
  Pie, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell 
} from "recharts";
import { Activity, TrendingUp, Users, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsCharts() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/dashboard/analytics'],
    refetchInterval: 60000,
  });

  if (isLoading || !analytics) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="section-card animate-pulse">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-lg w-3/4 mb-2"></div>
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/2"></div>
            </div>
            <div className="p-6">
              <div className="h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const formatTooltipValue = (value: number, name: string) => {
    if (name.includes('Amount') || name.includes('Balance') || name.includes('Savings') || name.includes('Loans')) {
      return formatCurrency(value);
    }
    return value.toLocaleString();
  };

  const chartCardClass = "section-card";
  const chartHeaderClass = "flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 dark:border-slate-700";
  const chartContentClass = "p-5";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
      <div className={chartCardClass}>
        <div className={chartHeaderClass}>
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Loan Distribution by Type</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Current loan portfolio breakdown</p>
          </div>
        </div>
        <div className={chartContentClass}>
          {analytics.loanDistribution && analytics.loanDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={analytics.loanDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => 
                    `${name}: ${(percent * 100).toFixed(1)}%`
                  }
                  outerRadius={90}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {analytics.loanDistribution?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-center">
              <DollarSign className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No loan data available</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Loan distribution will appear once loans are approved and active</p>
            </div>
          )}
        </div>
      </div>

      <div className={chartCardClass}>
        <div className={chartHeaderClass}>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Monthly Transaction Trends</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Transaction volume over the last 6 months</p>
          </div>
        </div>
        <div className={chartContentClass}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.monthlyTransactions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(value) => `${value / 1000}K`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={formatTooltipValue} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="deposits" stroke="#10b981" name="Deposits" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="withdrawals" stroke="#ef4444" name="Withdrawals" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="loanPayments" stroke="#3b82f6" name="Loan Payments" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={chartCardClass}>
        <div className={chartHeaderClass}>
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Users className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Member Growth</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">New members joined over time</p>
          </div>
        </div>
        <div className={chartContentClass}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics.memberGrowth}>
              <defs>
                <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
              <Area type="monotone" dataKey="newMembers" stroke="#8b5cf6" fill="url(#colorMembers)" name="New Members" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={chartCardClass}>
        <div className={chartHeaderClass}>
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <Activity className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Savings vs Loans Balance</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Monthly comparison of balances</p>
          </div>
        </div>
        <div className={chartContentClass}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.savingsVsLoans} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(value) => `${value / 1000000}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={formatTooltipValue} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="totalSavings" fill="#10b981" name="Total Savings" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalLoans" fill="#f59e0b" name="Total Loans" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
