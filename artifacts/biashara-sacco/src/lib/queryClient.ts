import { QueryClient, QueryFunction } from "@tanstack/react-query";

export type PasswordRequirements = {
  level: "low" | "medium" | "high";
  description: string;
};

export function validatePasswordAgainstRequirements(password: string, requirements: PasswordRequirements): string | null {
  const minimum = requirements.level === "high" ? 12 : requirements.level === "medium" ? 8 : 6;
  if (password.length < minimum) return `Password must be at least ${minimum} characters long`;
  if (requirements.level !== "low") {
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  }
  if (requirements.level === "high" && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*)";
  }
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let isSessionRedirecting = false;

function handleSessionExpired() {
  if (isSessionRedirecting) return;
  isSessionRedirecting = true;
  queryClient.setQueryData(["/api/auth/user"], null);
  queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  if (window.location.pathname !== "/login") {
    window.location.href = "/login?expired=1";
  } else {
    isSessionRedirecting = false;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && url !== "/api/auth/login" && url !== "/api/auth/login/2fa") {
    handleSessionExpired();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (queryKey[0] === "/api/auth/user") {
        return null;
      }
      handleSessionExpired();
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
