import { useQuery } from "@tanstack/react-query";
import type { User, Member } from "@shared/schema";
import type { UserRole } from "@/lib/rbac";

interface MemberWithRoles extends Member {
  roles?: UserRole[];
}

interface AuthUser extends User {
  member?: MemberWithRoles;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
