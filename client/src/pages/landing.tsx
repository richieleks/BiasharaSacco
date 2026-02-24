import { Button } from "@/components/ui/button";
import { PiggyBank, Users, HandCoins, TrendingUp, Shield, Globe, Landmark, ArrowRight, CheckCircle2, BarChart3, Lock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const features = [
    {
      icon: PiggyBank,
      title: "Smart Savings Management",
      description: "Track deposits, withdrawals, and interest calculations with automated accounting and real-time balance updates.",
      gradient: "from-blue-500 to-cyan-500",
      bg: "from-blue-500/10 to-cyan-500/10",
    },
    {
      icon: HandCoins,
      title: "Loan Processing",
      description: "Streamlined loan applications, multi-stage approvals, and repayment tracking with automated amortization schedules.",
      gradient: "from-emerald-500 to-teal-500",
      bg: "from-emerald-500/10 to-teal-500/10",
    },
    {
      icon: Users,
      title: "Member Management",
      description: "Complete member profiles, KYC documentation, and role-based access control for different user types.",
      gradient: "from-violet-500 to-purple-500",
      bg: "from-violet-500/10 to-purple-500/10",
    },
    {
      icon: BarChart3,
      title: "Financial Reporting",
      description: "Comprehensive dashboards and analytics to track SACCO performance, member growth, and financial health.",
      gradient: "from-amber-500 to-orange-500",
      bg: "from-amber-500/10 to-orange-500/10",
    },
    {
      icon: Shield,
      title: "Security & Compliance",
      description: "Enterprise-grade security with audit trails, encrypted data, and compliance with financial regulations.",
      gradient: "from-rose-500 to-pink-500",
      bg: "from-rose-500/10 to-pink-500/10",
    },
    {
      icon: Globe,
      title: "Multi-Platform Access",
      description: "Access your SACCO from anywhere with our responsive web platform optimized for desktop and mobile devices.",
      gradient: "from-indigo-500 to-blue-500",
      bg: "from-indigo-500/10 to-blue-500/10",
    },
  ];

  const stats = [
    { value: "99.9%", label: "Uptime" },
    { value: "256-bit", label: "Encryption" },
    { value: "24/7", label: "Access" },
    { value: "Real-time", label: "Analytics" },
  ];

  const benefits = [
    "Automated interest calculations with multiple methods",
    "Multi-stage loan approval workflows",
    "Comprehensive member statements and reports",
    "Role-based access control for staff and members",
    "Real-time notifications and alerts",
    "Data import from Excel and bank statements",
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-x-hidden overflow-y-auto">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }} />

        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-blue-500/5 backdrop-blur-3xl"
            style={{
              width: `${150 + i * 100}px`,
              height: `${150 + i * 100}px`,
              left: `${5 + i * 16}%`,
              top: `${10 + (i % 3) * 30}%`,
            }}
            animate={{
              y: [0, -40 + i * 12, 0],
              x: [0, 20 - i * 6, 0],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <header className="relative z-10 border-b border-white/[0.06] backdrop-blur-xl bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl blur-lg opacity-40" />
                <div className="relative bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl p-2.5">
                  <Landmark className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Biashara SACCO</h1>
                <p className="text-blue-300/60 text-[10px] font-medium tracking-wider uppercase">Management System</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => window.location.href = '/login'}
                className="text-slate-300 hover:text-white hover:bg-white/[0.06]"
              >
                Sign In
              </Button>
              <Button
                onClick={() => window.location.href = '/login'}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 rounded-xl text-sm font-semibold"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-10 pt-20 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 mb-8">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-300">Modern Cooperative Banking Platform</span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Empowering your
              <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                financial future
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
              A comprehensive platform for managing savings, loans, and member services
              with security and transparency at its core.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => window.location.href = '/login'}
                className="h-13 px-8 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 rounded-xl"
              >
                Get Started Today
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="h-13 px-8 text-sm font-semibold border-white/[0.1] text-slate-300 hover:bg-white/[0.06] hover:text-white rounded-xl"
              >
                Learn More
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm p-4"
              >
                <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="features" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h3 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Choose{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Biashara SACCO?
              </span>
            </h3>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              Everything you need for successful cooperative financial management
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm p-6 hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className={`inline-flex rounded-xl bg-gradient-to-br ${feature.bg} p-3 mb-4`}>
                  <feature.icon className={`h-6 w-6 bg-gradient-to-br ${feature.gradient} bg-clip-text`} style={{
                    color: feature.gradient.includes('blue') ? '#60a5fa' :
                           feature.gradient.includes('emerald') ? '#34d399' :
                           feature.gradient.includes('violet') ? '#a78bfa' :
                           feature.gradient.includes('amber') ? '#fbbf24' :
                           feature.gradient.includes('rose') ? '#fb7185' : '#818cf8'
                  }} />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">{feature.title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-10 lg:p-14">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <h3 className="text-3xl font-bold mb-4">
                    Built for{" "}
                    <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                      modern SACCOs
                    </span>
                  </h3>
                  <p className="text-slate-400 mb-8 leading-relaxed">
                    Our platform provides all the tools and features you need to run
                    your cooperative efficiently and transparently.
                  </p>
                  <ul className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + index * 0.08 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-300">{benefit}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </div>

              <div className="relative bg-gradient-to-br from-blue-600/20 to-emerald-600/20 p-10 lg:p-14 flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="relative text-center"
                >
                  <div className="inline-flex rounded-3xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/[0.08] p-8 mb-6">
                    <Landmark className="h-16 w-16 text-blue-400" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-2">Trusted Platform</h4>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    Enterprise-grade infrastructure with bank-level security protecting your financial data
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
                    <Lock className="h-3 w-3" />
                    <span>End-to-end encrypted</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-gradient-to-r from-blue-600/20 to-emerald-600/20 border border-white/[0.08] backdrop-blur-sm p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
            <div className="relative">
              <h3 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to Transform Your SACCO?
              </h3>
              <p className="text-lg text-slate-400 mb-8 max-w-lg mx-auto">
                Join the platform trusted by cooperative societies for managing their financial operations
              </p>
              <Button
                size="lg"
                onClick={() => window.location.href = '/login'}
                className="h-13 px-10 text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 rounded-xl"
              >
                Sign In to Your Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl p-2">
              <Landmark className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Biashara SACCO</span>
          </div>
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Biashara SACCO Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
