import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Presentation, PiggyBank, HandCoins, Shield } from "lucide-react";
import { SaccoLogo } from "@/components/sacco-logo";
import { motion, useReducedMotion } from "framer-motion";

export default function Landing() {
  const reducedMotion = useReducedMotion();
  const handleLogin = () => window.location.href = '/login';

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundImage: "radial-gradient(ellipse at top left, rgba(30,58,138,0.4), transparent 65%), radial-gradient(ellipse at bottom right, rgba(6,78,59,0.2), transparent 65%)" }} className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30 selection:text-white flex flex-col">
      <header className="px-6 py-8 sm:px-12 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <SaccoLogo size="sm" />
           <span className="font-semibold tracking-tight text-white">Biashara SACCO</span>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogin}
          className="text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium tracking-wide"
        >
          Sign in
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-2xl text-center space-y-8"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-8 border border-blue-500/20">
            <Shield className="w-8 h-8 text-blue-400 stroke-[1.5]" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-white leading-[1.1]">
            Your member-owned <br className="hidden sm:block" /> <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">financial cooperative.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-xl mx-auto font-light">
            A secure and transparent platform for managing your savings, loans, and member services.
          </p>

          <div className="pt-8">
            <Button
              size="lg"
              onClick={handleLogin}
              className="h-12 px-8 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-full text-base font-medium transition-all shadow-lg shadow-blue-500/25"
            >
              Sign in to portal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="grid sm:grid-cols-3 gap-12 sm:gap-8 mt-32 max-w-4xl w-full"
        >
          <div className="text-center sm:text-left space-y-3">
            <div className="mx-auto sm:mx-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <PiggyBank className="w-5 h-5 text-blue-400 stroke-[1.5]" />
            </div>
            <h3 className="font-medium text-white">Smart Savings</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Track your deposits and real-time balances with automated accounting.
            </p>
          </div>

          <div className="text-center sm:text-left space-y-3">
            <div className="mx-auto sm:mx-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <HandCoins className="w-5 h-5 text-emerald-400 stroke-[1.5]" />
            </div>
            <h3 className="font-medium text-white">Fair Loans</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Streamlined applications and transparent repayment schedules.
            </p>
          </div>

          <div className="text-center sm:text-left space-y-3">
            <div className="mx-auto sm:mx-0 w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-violet-400 stroke-[1.5]" />
            </div>
            <h3 className="font-medium text-white">Member Services</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Access your account and keep your membership details up to date.
            </p>
          </div>
        </motion.div>
      </main>

      <footer className="px-6 py-8 sm:px-12 border-t border-white/[0.06] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} Biashara SACCO Management System.</p>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <a
              href="/biashara-showcase/exports/biashara-sacco-showcase.pdf"
              download
              className="flex items-center gap-2 hover:text-white transition-colors"
              data-testid="link-download-pdf"
            >
              <FileText className="w-4 h-4 stroke-[1.5]" />
              <span>Platform Overview (PDF)</span>
            </a>
            <a
              href="/biashara-showcase/exports/biashara-sacco-showcase.pptx"
              download
              className="flex items-center gap-2 hover:text-white transition-colors"
              data-testid="link-download-pptx"
            >
              <Presentation className="w-4 h-4 stroke-[1.5]" />
              <span>Presentation (PPTX)</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}