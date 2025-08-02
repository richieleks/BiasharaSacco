import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PiggyBank, Users, HandCoins, TrendingUp, Shield, Globe } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sacco-gradient rounded-lg flex items-center justify-center">
                <PiggyBank className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Biashara SACCO</h1>
                <p className="text-xs text-slate-500">Savings & Loans Management</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Button 
                onClick={() => window.location.href = '/login'}
                className="sacco-gradient text-white hover:opacity-90"
              >
                Sign In
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/api/login'}
              >
                Sign In with Replit
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">
            Empowering Financial Growth Through Cooperative Banking
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Join Biashara SACCO and take control of your financial future with our comprehensive 
            savings and loans management platform designed for the modern cooperative.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              className="sacco-gradient text-white hover:opacity-90"
            >
              Get Started Today
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-slate-900 mb-4">
              Why Choose Biashara SACCO?
            </h3>
            <p className="text-lg text-slate-600">
              Our platform offers everything you need for successful cooperative financial management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <PiggyBank className="text-blue-600 text-xl" />
                </div>
                <CardTitle>Smart Savings Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Track deposits, withdrawals, and interest calculations with automated 
                  accounting and real-time balance updates.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <HandCoins className="text-green-600 text-xl" />
                </div>
                <CardTitle>Loan Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Streamlined loan applications, approvals, and repayment tracking with 
                  automated amortization schedules.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="text-purple-600 text-xl" />
                </div>
                <CardTitle>Member Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Complete member profiles, KYC documentation, and role-based access 
                  control for different user types.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="text-yellow-600 text-xl" />
                </div>
                <CardTitle>Financial Reporting</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Comprehensive reports and analytics to track SACCO performance, 
                  member growth, and financial health.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="text-red-600 text-xl" />
                </div>
                <CardTitle>Security & Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Bank-level security with audit trails, data encryption, and 
                  compliance with financial regulations.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="text-indigo-600 text-xl" />
                </div>
                <CardTitle>Multi-Platform Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Access your SACCO from anywhere with our responsive web platform 
                  optimized for desktop and mobile devices.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 sacco-gradient">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your SACCO?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of members who trust Biashara SACCO for their financial needs
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => window.location.href = '/api/login'}
            className="bg-white text-blue-600 hover:bg-blue-50"
          >
            Sign In to Your Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-300 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 sacco-gradient rounded-lg flex items-center justify-center">
              <PiggyBank className="text-white text-sm" />
            </div>
            <span className="text-lg font-semibold text-white">Biashara SACCO</span>
          </div>
          <p className="text-sm">
            © 2024 Biashara SACCO. All rights reserved. Built for cooperative financial excellence.
          </p>
        </div>
      </footer>
    </div>
  );
}
