import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";

interface CollapsibleSidebarProps {
  className?: string;
}

const GROUP_ORDER = ['Main', 'Finance', 'Reports', 'Administration'];

const GROUP_COLORS: Record<string, string> = {
  Main: 'text-blue-500',
  Finance: 'text-emerald-500',
  Reports: 'text-amber-500',
  Administration: 'text-purple-500',
};

export default function CollapsibleSidebar({ className }: CollapsibleSidebarProps) {
  const { getNavigationItems, userRole } = useRBAC();
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const navItems = getNavigationItems();

  const getIcon = (iconName: string) => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent || Icons.Circle;
  };

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const groupedItems = GROUP_ORDER.map(group => ({
    group,
    items: navItems.filter((item: any) => (item.group || 'Main') === group),
  })).filter(g => g.items.length > 0);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("space-y-1", mobile ? "p-5" : "")}>
      {!mobile && (
        <div className={cn("mb-5 px-3", isCollapsed && "px-2")}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sacco-gradient rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-xs">BS</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-none">Biashara SACCO</h2>
                <p className="text-[11px] text-slate-400 capitalize mt-0.5 font-medium">
                  {userRole} Portal
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 sacco-gradient rounded-lg flex items-center justify-center shadow-sm mx-auto">
              <span className="text-white font-bold text-xs">BS</span>
            </div>
          )}
        </div>
      )}

      {mobile && (
        <div className="mb-5 flex items-center gap-2.5">
          <div className="w-8 h-8 sacco-gradient rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xs">BS</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-none">Biashara SACCO</h2>
            <p className="text-[11px] text-slate-400 capitalize mt-0.5 font-medium">
              {userRole} Portal
            </p>
          </div>
        </div>
      )}
      
      {groupedItems.map(({ group, items }, groupIndex) => (
        <div key={group}>
          {group !== 'Main' && (
            <>
              {(!isCollapsed || mobile) ? (
                <div className={cn("px-3 pt-5 pb-1.5", groupIndex > 0 && "mt-1")}>
                  <span className={cn("text-[10px] font-bold uppercase tracking-[0.08em]", GROUP_COLORS[group] || 'text-slate-400')}>
                    {group}
                  </span>
                </div>
              ) : (
                <div className="my-3 mx-3">
                  <div className="border-t border-slate-100" />
                </div>
              )}
            </>
          )}
          <div className="space-y-0.5 px-2">
            {items.map((item: any) => {
              const Icon = getIcon(item.icon || 'Circle');
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start transition-all duration-150 h-9 rounded-lg text-[13px] font-medium",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      isCollapsed && !mobile && "px-2 justify-center",
                      mobile && "justify-start"
                    )}
                    size="sm"
                  >
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-150",
                      isCollapsed && !mobile ? "mr-0" : "mr-2.5",
                      isActive ? "" : "text-slate-400"
                    )} />
                    {(!isCollapsed || mobile) && (
                      <span>{item.name}</span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="lg:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="fixed top-4 left-4 z-50 lg:hidden bg-white/90 glass shadow-md rounded-xl border border-slate-200/60"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-r border-slate-200/60">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Navigation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileOpen(false)}
                className="rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-65px)]">
              <SidebarContent mobile />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <aside className={cn(
        "hidden lg:block bg-white/50 glass border-r border-slate-200/60 transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-[68px]" : "w-60",
        className
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:shadow",
            "flex items-center justify-center p-0"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3 text-slate-500" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-slate-500" />
          )}
        </Button>

        <div className="h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
          <div className={cn("py-4", isCollapsed ? "px-1" : "px-2")}>
            <SidebarContent />
          </div>
        </div>
      </aside>
    </>
  );
}
