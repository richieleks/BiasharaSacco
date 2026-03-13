import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, User, Settings, LogOut, Shield, ArrowRightLeft, Check } from "lucide-react";
import { SaccoLogo } from "@/components/sacco-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  committee: 'Committee',
  treasurer: 'Treasurer',
  teller: 'Teller',
  member: 'Member',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300',
  manager: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300',
  committee: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
  treasurer: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
  teller: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700',
  member: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',
};

export default function Header() {
  const { user } = useAuth();
  const { hasPermission, userRoles, activeRole, switchRole, canSwitchRoles } = useRBAC();
  const [, navigate] = useLocation();

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 ml-12 lg:ml-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <SaccoLogo size="sm" />
              <div className="hidden sm:block">
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">Biashara SACCO</h1>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Savings & Loans Management</p>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700/80 mx-1 hidden sm:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl px-2.5 py-1.5 h-auto">
                  <div className="w-8 h-8 rounded-lg sacco-gradient flex items-center justify-center shadow-sm">
                    <span className="text-white text-xs font-semibold">
                      {getInitials(user?.firstName, user?.lastName)}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 font-medium ${ROLE_COLORS[activeRole] || ROLE_COLORS.member}`}>
                        {ROLE_LABELS[activeRole] || activeRole}
                      </Badge>
                      {canSwitchRoles && (
                        <ArrowRightLeft className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold leading-none text-slate-900 dark:text-slate-100">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator className="my-1" />

                {canSwitchRoles && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="rounded-lg cursor-pointer px-3 py-2">
                        <ArrowRightLeft className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm">Switch Role</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="rounded-xl p-1.5">
                        {userRoles.map((role) => (
                          <DropdownMenuItem
                            key={role}
                            onClick={() => {
                              switchRole(role);
                              navigate('/dashboard');
                            }}
                            className="rounded-lg cursor-pointer px-3 py-2"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 font-medium ${ROLE_COLORS[role] || ROLE_COLORS.member}`}>
                                  {ROLE_LABELS[role] || role}
                                </Badge>
                              </div>
                              {activeRole === role && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator className="my-1" />
                  </>
                )}
                
                <DropdownMenuItem onClick={() => navigate('/profile')} className="rounded-lg cursor-pointer px-3 py-2">
                  <User className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm">Profile</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-lg cursor-pointer px-3 py-2">
                  <Settings className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm">Settings</span>
                </DropdownMenuItem>
                
                {hasPermission('read', 'system-settings') && (
                  <DropdownMenuItem onClick={() => navigate('/admin-settings')} className="rounded-lg cursor-pointer px-3 py-2">
                    <Shield className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm">Admin Settings</span>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator className="my-1" />
                
                <DropdownMenuItem onClick={() => window.location.href = '/api/logout'} className="rounded-lg cursor-pointer px-3 py-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:bg-red-950/50">
                  <LogOut className="mr-2.5 h-4 w-4" />
                  <span className="text-sm">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
