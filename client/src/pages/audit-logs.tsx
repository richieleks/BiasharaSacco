import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRBAC } from "@/hooks/useRBAC";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [filters, setFilters] = useState({
    resource: "all",
    action: "all",
    searchQuery: "",
  });
  const { hasPermission } = useRBAC();

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

  const queryParams = new URLSearchParams();
  if (filters.resource !== 'all') queryParams.append('resource', filters.resource);
  if (filters.action !== 'all') queryParams.append('action', filters.action);
  
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/audit-logs', queryParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/audit-logs?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    },
  });

  const filteredLogs = (logs as any[]).filter((log: any) => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return (
        log.user?.email?.toLowerCase().includes(query) ||
        log.member?.fullName?.toLowerCase().includes(query) ||
        log.details?.toLowerCase().includes(query) ||
        log.resourceId?.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Track all system activities and user actions
        </p>
      </div>

      {/* Filters */}
      <div className="section-card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Filter audit logs by resource, action, or search for specific entries
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              value={filters.resource}
              onValueChange={(value) => setFilters({ ...filters, resource: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="loan">Loans</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="transaction">Transactions</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.action}
              onValueChange={(value) => setFilters({ ...filters, action: value })}
            >
              <SelectTrigger>
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

            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by user, details, or resource ID..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
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
                <TableHead>Timestamp</TableHead>
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
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
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
      </div>
    </div>
  );
}
