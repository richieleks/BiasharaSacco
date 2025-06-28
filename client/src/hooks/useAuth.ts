import { useQuery } from "@tanstack/react-query";
import type { User, Member } from "@shared/schema";

interface AuthUser extends User {
  member?: Member;
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
