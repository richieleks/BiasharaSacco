import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRBAC } from "@/hooks/useRBAC";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Search, Calendar, Activity, FileText, UserX } from "lucide-react";
import { format } from "date-fns";

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  approve: "bg-purple-100 text-purple-800",
  reject: "bg-orange-100 text-orange-800",
  login: "bg-gray-100 text-gray-800",
  logout: "bg-gray-100 text-gray-800",
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

  // Check if user has permission to view audit logs
  if (!hasPermission('read', 'audit-logs')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold">Access Denied</h3>
              <p className="text-gray-600 mt-2">You don't have permission to view audit logs.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build query params, excluding "all" values
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
    const colorClass = actionColors[action] || "bg-gray-100 text-gray-800";
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Track all system activities and user actions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter audit logs by resource, action, or search for specific entries
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Recent system activities and user actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
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
                      <TableCell>
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
                      <TableCell className="max-w-xs truncate">
                        {log.details || '-'}
                      </TableCell>
                      <TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}