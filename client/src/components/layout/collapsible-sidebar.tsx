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

export default function CollapsibleSidebar({ className }: CollapsibleSidebarProps) {
  const { getNavigationItems, userRole } = useRBAC();
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const navItems = getNavigationItems();

  // Dynamically get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent || Icons.Circle;
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  // Persist sidebar collapse state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("space-y-2", mobile ? "p-6" : "")}>
      {!mobile && (
        <div className={cn("mb-6 px-3", isCollapsed && "px-2")}>
          {!isCollapsed ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Biashara SACCO</h2>
              <p className="text-sm text-slate-600 capitalize mt-1">
                {userRole} Dashboard
              </p>
            </>
          ) : (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">BS</span>
            </div>
          )}
        </div>
      )}

      {mobile && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Biashara SACCO</h2>
          <p className="text-sm text-slate-600 capitalize mt-1">
            {userRole} Dashboard
          </p>
        </div>
      )}
      
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = getIcon(item.icon || 'Circle');
          const isActive = location === item.path;
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  isCollapsed && !mobile && "px-2 justify-center",
                  mobile && "justify-start"
                )}
                size={isCollapsed && !mobile ? "sm" : "default"}
              >
                <Icon className={cn(
                  "h-4 w-4 transition-all duration-200",
                  isCollapsed && !mobile ? "mr-0" : "mr-3"
                )} />
                {(!isCollapsed || mobile) && (
                  <span className="transition-all duration-200">{item.name}</span>
                )}
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-md"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarContent mobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:block bg-white border-r border-slate-200 transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-16" : "w-64",
        className
      )}>
        {/* Collapse Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50",
            "flex items-center justify-center"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        <div className="h-full sticky top-16 overflow-y-auto">
          <div className={cn("p-4", isCollapsed && "p-2")}>
            <SidebarContent />
          </div>
        </div>
      </aside>
    </>
  );
}