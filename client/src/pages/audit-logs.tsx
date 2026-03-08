import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRBAC } from "@/hooks/useRBAC";
import { useServerPagination } from "@/hooks/useServerPagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Shield, Search, Calendar, Activity, FileText, UserX } from "lucide-react";
import { format } from "date-fns";

const actionColors: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  update: "bg-blue-50 text-blue-700 border-blue-200/50",
  delete: "bg-red-50 text-red-700 border-red-200/50",
  approve: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  reject: "bg-amber-50 text-amber-700 border-amber-200/50",
  login: "bg-blue-50 text-blue-700 border-blue-200/50",
  logout: "bg-blue-50 text-blue-700 border-blue-200/50",
};

const resourceIcons: Record<string, any> = {
  member: UserX,
  loan: FileText,
  savings: Activity,
  transaction: FileText,
  settings: Shield,
};

export default function AuditLogs() {
  const { hasPermission } = useRBAC();

  const {
    page,
    limit,
    search,
    setPage,
    setLimit,
    setSearch,
    buildQueryParams,
  } = useServerPagination({ initialLimit: 25 });

  const [searchInput, setSearchInput] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  if (!hasPermission('read', 'audit-logs')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="section-card max-w-md">
          <div className="p-6">
            <div className="py-16 text-center">
              <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold">Access Denied</h3>
              <p className="text-gray-600 mt-2">You don't have permission to view audit logs.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleResourceFilter = (value: string) => {
    setResourceFilter(value === "all" ? "" : value);
    setPage(1);
  };

  const handleActionFilter = (value: string) => {
    setActionFilter(value === "all" ? "" : value);
    setPage(1);
  };

  const baseQueryParams = buildQueryParams();
  const queryParams = (() => {
    const params = new URLSearchParams(baseQueryParams);
    if (resourceFilter) params.set('resource', resourceFilter);
    if (actionFilter) params.set('action', actionFilter);
    return params.toString();
  })();

  const { data: response, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['/api/audit-logs', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${queryParams}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
  });

  const logs = response?.data || [];
  const totalItems = response?.total || 0;

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  };

  const getActionBadge = (action: string) => {
    const colorClass = actionColors[action] || "bg-blue-50 text-blue-700 border-blue-200/50";
    return (
      <Badge variant="outline" className={colorClass}>
        {action.charAt(0).toUpperCase() + action.slice(1)}
      </Badge>
    );
  };

  const getResourceIcon = (resource: string) => {
    const Icon = resourceIcons[resource] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6 page-container animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Track all system activities and user actions
        </p>
      </div>

      <div className="section-card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Search and filter audit logs by user, action, resource, or details
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                data-testid="input-search-audit-logs"
                placeholder="Search by user, details, or resource..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={resourceFilter || "all"} onValueChange={handleResourceFilter}>
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-resource-filter">
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="transaction">Transaction</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter || "all"} onValueChange={handleActionFilter}>
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-action-filter">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Activity Log</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Recent system activities and user actions
          </p>
        </div>
        <div className="p-6 overflow-x-auto">
          <Table className="table-modern">
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Resource</TableHead>
                <TableHead className="hidden lg:table-cell">Details</TableHead>
                <TableHead className="hidden lg:table-cell">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                    <TableCell className="font-medium hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{log.user?.email || 'System'}</div>
                        {log.member && (
                          <div className="text-sm text-muted-foreground">
                            {log.member.fullName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        {getResourceIcon(log.resource)}
                        <span className="capitalize">{log.resource}</span>
                        {log.resourceId && (
                          <span className="text-sm text-muted-foreground">
                            #{log.resourceId}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs truncate">
                      {log.details || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {log.ipAddress || '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalItems > 0 && (
          <Pagination
            totalItems={totalItems}
            itemsPerPage={limit}
            currentPage={page}
            onPageChange={setPage}
            onItemsPerPageChange={setLimit}
          />
        )}
      </div>
    </div>
  );
}
