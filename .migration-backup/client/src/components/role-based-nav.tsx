import { Link, useLocation } from "wouter";
import { useRBAC } from "@/hooks/useRBAC";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";

export default function RoleBasedNavigation() {
  const { getNavigationItems, userRole } = useRBAC();
  const [location] = useLocation();
  const navItems = getNavigationItems();

  // Dynamically get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = Icons[iconName as keyof typeof Icons] as any;
    return IconComponent || Icons.Circle;
  };

  return (
    <nav className="space-y-2">
      <div className="mb-4 px-3">
        <h2 className="text-lg font-semibold">Navigation</h2>
        <p className="text-sm text-muted-foreground capitalize">
          {userRole} Dashboard
        </p>
      </div>
      
      {navItems.map((item) => {
        const Icon = getIcon(item.icon || 'Circle');
        const isActive = location === item.path;
        
        return (
          <Link key={item.path} href={item.path}>
            <Button
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive && "bg-primary text-primary-foreground"
              )}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.name}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}