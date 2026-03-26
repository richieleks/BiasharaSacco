import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, Building2, Shield, Users, PiggyBank, KeyRound, TrendingUp, Lock, Eye, EyeOff } from "lucide-react";
import { SaccoLogo } from "@/components/sacco-logo";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorUsername, setTwoFactorUsername] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to change password");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowChangePassword(false);
      window.location.href = "/";
    },
    onError: (error: Error) => {
      setChangePasswordError(error.message);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        let errorMessage = "Login failed";
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          const text = await response.text().catch(() => "");
          if (response.status === 401) {
            errorMessage = "Invalid username or password";
          } else if (text) {
            errorMessage = text.length > 100 ? "Server error. Please try again." : text;
          }
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresTwoFactor) {
        setTwoFactorUsername(data.username);
        setShow2FA(true);
        setError("");
        return;
      }
      if (data.mustChangePassword) {
        setShowChangePassword(true);
      } else {
        window.location.href = "/";
      }
    },
    onError: (error: Error) => {
      setError(error.message || "Invalid username or password");
    },
  });

  const twoFactorMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; code: string }) => {
      const response = await fetch("/api/auth/login/2fa", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        let errorMessage = "Verification failed";
        try {
          const err = await response.json();
          errorMessage = err.message || errorMessage;
        } catch {
          errorMessage = response.status === 401 ? "Invalid credentials" : "Server error. Please try again.";
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.mustChangePassword) {
        setShow2FA(false);
        setShowChangePassword(true);
      } else {
        window.location.href = "/";
      }
    },
    onError: (error: Error) => {
      setError(error.message || "Invalid verification code");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    loginMutation.mutate({ username, password });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError("");
    if (newPassword.length < 6) {
      setChangePasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError("Passwords do not match");
      return;
    }
    changePasswordMutation.mutate({ newPassword });
  };

  const features = [
    { icon: PiggyBank, label: "Savings Management" },
    { icon: TrendingUp, label: "Loan Processing" },
    { icon: Shield, label: "Secure & Reliable" },
    { icon: Users, label: "Member Services" },
  ];

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-blue-500/5 backdrop-blur-3xl"
          style={{
            width: `${120 + i * 80}px`,
            height: `${120 + i * 80}px`,
            left: `${10 + i * 18}%`,
            top: `${15 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -30 + i * 10, 0],
            x: [0, 15 - i * 5, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 8 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16 xl:px-24">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="flex items-center gap-4 mb-8">
            <SaccoLogo size="lg" className="drop-shadow-lg" />
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Biashara SACCO</h1>
              <p className="text-blue-300/70 text-sm font-medium tracking-wider uppercase">Management System</p>
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Empowering your
            <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              financial future
            </span>
          </h2>

          <p className="text-slate-400 text-lg leading-relaxed mb-12 max-w-md">
            A comprehensive platform for managing savings, loans, and member services with security and transparency at its core.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3.5 backdrop-blur-sm hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 p-2">
                  <feature.icon className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-300">{feature.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center relative z-10 px-6 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <SaccoLogo size="md" className="drop-shadow-lg" />
            <div>
              <h1 className="text-xl font-bold text-white">Biashara SACCO</h1>
              <p className="text-blue-300/60 text-xs font-medium tracking-wider uppercase">Management System</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl p-8 sm:p-10 shadow-2xl shadow-black/20">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Welcome back</h3>
              <p className="text-slate-400 text-sm">Sign in to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-slate-300">
                  Username
                </Label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    className="h-12 pl-10 pr-4 text-sm bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:bg-white/[0.08] focus:border-blue-500/50 focus:ring-blue-500/20 transition-all rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-12 pl-10 pr-12 text-sm bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:bg-white/[0.08] focus:border-blue-500/50 focus:ring-blue-500/20 transition-all rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    <Shield className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 rounded-xl"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Lock className="h-3 w-3" />
                <span>Protected by enterprise-grade security</span>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-xs text-slate-600"
          >
            Biashara SACCO Management System &copy; {new Date().getFullYear()}
          </motion.div>
        </motion.div>
      </div>

      <Dialog open={showChangePassword} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <KeyRound className="h-8 w-8 text-amber-400" />
              </div>
            </div>
            <DialogTitle className="text-center text-white text-xl">Change Your Password</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Your password has been reset by an administrator. Please set a new password to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-300">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-blue-500/50 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 pr-10 bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-blue-500/50 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {changePasswordError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <Shield className="h-4 w-4 flex-shrink-0" />
                {changePasswordError}
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 rounded-xl font-semibold"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Set New Password"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={show2FA} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                <Shield className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <DialogTitle className="text-center text-white text-xl">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Enter the 6-digit code from your authenticator app to complete sign in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            setError("");
            twoFactorMutation.mutate({ username: twoFactorUsername, password, code: twoFactorCode });
          }} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="twoFactorCode" className="text-slate-300">Verification Code</Label>
              <Input
                id="twoFactorCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-2xl tracking-[0.5em] bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-blue-500/50 rounded-xl"
                autoFocus
                data-testid="input-2fa-code"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <Shield className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 rounded-xl font-semibold"
              disabled={twoFactorMutation.isPending || twoFactorCode.length !== 6}
              data-testid="button-verify-2fa"
            >
              {twoFactorMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Sign In"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:text-white"
              onClick={() => {
                setShow2FA(false);
                setTwoFactorCode("");
                setError("");
              }}
              data-testid="button-back-to-login"
            >
              Back to login
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
