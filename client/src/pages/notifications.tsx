import { useState } from "react";
import { Bell, Filter, Search, Trash2, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, useDeleteNotification } from "@/hooks/useNotifications";
import { useWebSocket } from "@/hooks/useWebSocket";
import { format } from "date-fns";
import type { Notification } from "@shared/schema";

const priorityColors = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const typeIcons = {
  loan_application: "💰",
  loan_approval: "✅",
  loan_rejection: "❌",
  payment_due: "⏰",
  payment_received: "💵",
  member_approved: "👤",
  member_rejected: "🚫",
  guarantor_request: "🤝",
  guarantor_response: "📝",
  transaction_completed: "💸",
  system_alert: "⚠️",
  role_changed: "🔧",
  account_update: "📊",
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const { isConnected } = useWebSocket();
  
  // Get notifications based on active tab
  const filters: any = { limit: 100 };
  if (activeTab === "unread") {
    filters.isRead = false;
  } else if (activeTab === "read") {
    filters.isRead = true;
  }
  if (priorityFilter) {
    filters.priority = priorityFilter;
  }
  if (typeFilter) {
    filters.type = typeFilter;
  }

  const { data: notifications = [], isLoading } = useNotifications(filters);
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();

  // Filter notifications by search query
  const filteredNotifications = notifications.filter((notification: Notification) =>
    notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadNotifications = notifications.filter((n: Notification) => !n.isRead);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleDeleteNotification = (notificationId: number) => {
    deleteNotification.mutate(notificationId);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notifications
          </h1>
          <p className="text-muted-foreground">
            Stay updated with your SACCO activities and important alerts
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isConnected && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              ● Real-time updates enabled
            </Badge>
          )}
          {unreadNotifications.length > 0 && (
            <Button onClick={handleMarkAllAsRead} disabled={markAllAsRead.isPending}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read ({unreadNotifications.length})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Search
          </CardTitle>
          <CardDescription>
            Find specific notifications using filters and search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="loan_application">Loan Applications</SelectItem>
                <SelectItem value="loan_approval">Loan Approvals</SelectItem>
                <SelectItem value="loan_rejection">Loan Rejections</SelectItem>
                <SelectItem value="payment_due">Payment Due</SelectItem>
                <SelectItem value="payment_received">Payment Received</SelectItem>
                <SelectItem value="member_approved">Member Approved</SelectItem>
                <SelectItem value="member_rejected">Member Rejected</SelectItem>
                <SelectItem value="guarantor_request">Guarantor Requests</SelectItem>
                <SelectItem value="guarantor_response">Guarantor Responses</SelectItem>
                <SelectItem value="transaction_completed">Transaction Completed</SelectItem>
                <SelectItem value="system_alert">System Alerts</SelectItem>
                <SelectItem value="role_changed">Role Changes</SelectItem>
                <SelectItem value="account_update">Account Updates</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setPriorityFilter("");
                setTypeFilter("");
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({unreadNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="read">
            Read ({notifications.length - unreadNotifications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  Loading notifications...
                </div>
              </CardContent>
            </Card>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  {searchQuery || priorityFilter || typeFilter
                    ? "No notifications match your filters"
                    : activeTab === "unread"
                    ? "No unread notifications"
                    : activeTab === "read"
                    ? "No read notifications"
                    : "No notifications yet"
                  }
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification: Notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    !notification.isRead ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-2xl">
                          {typeIcons[notification.type as keyof typeof typeIcons] || "📢"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{notification.title}</h3>
                            {notification.priority && notification.priority !== "medium" && (
                              <Badge 
                                variant="secondary" 
                                className={priorityColors[notification.priority as keyof typeof priorityColors]}
                              >
                                {notification.priority}
                              </Badge>
                            )}
                            {!notification.isRead && (
                              <Badge variant="default" className="bg-blue-500">
                                New
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                            {notification.readAt && (
                              <span>Read {format(new Date(notification.readAt), "MMM d 'at' h:mm a")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead.mutate(notification.id);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}