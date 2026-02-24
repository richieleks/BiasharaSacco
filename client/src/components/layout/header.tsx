import { useAuth } from "@/hooks/useAuth";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PiggyBank, ChevronDown, User, Settings, LogOut, Shield } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";

export default function Header() {
  const { user } = useAuth();
  const { hasPermission } = useRBAC();
  const [, navigate] = useLocation();

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 ml-12 lg:ml-0">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="w-9 h-9 sacco-gradient rounded-xl flex items-center justify-center shadow-sm">
                <PiggyBank className="text-white h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Biashara SACCO</h1>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Savings & Loans Management</p>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            
            <div className="w-px h-8 bg-slate-200/80 mx-1 hidden sm:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2.5 hover:bg-slate-100/80 rounded-xl px-2.5 py-1.5 h-auto">
                  <div className="w-8 h-8 rounded-lg sacco-gradient flex items-center justify-center shadow-sm">
                    <span className="text-white text-xs font-semibold">
                      {getInitials(user?.firstName, user?.lastName)}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-slate-800 leading-none">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium capitalize mt-0.5">{user?.role || "Member"}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold leading-none text-slate-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator className="my-1" />
                
                <DropdownMenuItem onClick={() => navigate('/profile')} className="rounded-lg cursor-pointer px-3 py-2">
                  <User className="mr-2.5 h-4 w-4 text-slate-500" />
                  <span className="text-sm">Profile</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate('/settings')} className="rounded-lg cursor-pointer px-3 py-2">
                  <Settings className="mr-2.5 h-4 w-4 text-slate-500" />
                  <span className="text-sm">Settings</span>
                </DropdownMenuItem>
                
                {hasPermission('read', 'system-settings') && (
                  <DropdownMenuItem onClick={() => navigate('/admin-settings')} className="rounded-lg cursor-pointer px-3 py-2">
                    <Shield className="mr-2.5 h-4 w-4 text-slate-500" />
                    <span className="text-sm">Admin Settings</span>
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator className="my-1" />
                
                <DropdownMenuItem onClick={() => window.location.href = '/api/logout'} className="rounded-lg cursor-pointer px-3 py-2 text-red-600 focus:text-red-600 focus:bg-red-50">
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
