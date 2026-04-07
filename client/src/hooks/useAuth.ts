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
  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 2 * 60 * 1000,
  });

  return {
    user: user ?? undefined,
    isLoading,
    isAuthenticated: !!user,
  };
}
