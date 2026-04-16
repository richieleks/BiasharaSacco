import type { Express, Request, Response } from "express";
import { db } from "./db";
import { sql, eq, and, inArray, desc, gte, lte } from "drizzle-orm";
import { saccoAccounts, saccoJournalEntries, loans, members, savingsAccounts as savingsAccountsTable, loanProvisions, loanWriteoffs, loanRestructures, dividendDistributions, memberDividends, financialYears, amortizationSchedules } from "@shared/schema";
import { isAuthenticated } from "./replitAuth";
import { requirePermission, requireRole, type AuthRequest } from "./rbac-middleware";
import { storage } from "./storage";

export function registerFinancialReportRoutes(app: Express) {

  app.get("/api/reports/trial-balance", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];

      const accounts = await db.select().from(saccoAccounts).where(eq(saccoAccounts.isActive, true));

      const journalTotals = await db.execute(sql`
        SELECT 
          sa.id,
          sa.account_code,
          sa.account_name,
          sa.account_type,
          COALESCE(SUM(CASE WHEN je.debit_account_id = sa.id AND je.entry_date <= ${asOfDate} THEN je.amount::numeric ELSE 0 END), 0) as total_debits,
          COALESCE(SUM(CASE WHEN je.credit_account_id = sa.id AND je.entry_date <= ${asOfDate} THEN je.amount::numeric ELSE 0 END), 0) as total_credits
        FROM sacco_accounts sa
        LEFT JOIN sacco_journal_entries je ON (je.debit_account_id = sa.id OR je.credit_account_id = sa.id) AND je.status = 'posted'
        WHERE sa.is_active = true
        GROUP BY sa.id, sa.account_code, sa.account_name, sa.account_type
        ORDER BY sa.account_code
      `);

      const rows = (journalTotals as any).rows || journalTotals;
      let totalDebits = 0;
      let totalCredits = 0;

      const trialBalanceRows = rows.map((row: any) => {
        const debits = parseFloat(row.total_debits || '0');
        const credits = parseFloat(row.total_credits || '0');
        totalDebits += debits;
        totalCredits += credits;

        return {
          accountCode: row.account_code,
          accountName: row.account_name,
          accountType: row.account_type,
          totalDebits: debits,
          totalCredits: credits,
          debitBalance: debits > credits ? debits - credits : 0,
          creditBalance: credits > debits ? credits - debits : 0,
        };
      }).filter((r: any) => r.totalDebits > 0 || r.totalCredits > 0);

      res.json({
        asOfDate,
        rows: trialBalanceRows,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        difference: Math.abs(totalDebits - totalCredits),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/balance-sheet", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];

      const [savingsTotal] = await db.select({ total: sql<string>`COALESCE(SUM(balance::numeric), 0)` }).from(savingsAccountsTable);
      const [loansTotal] = await db.select({ total: sql<string>`COALESCE(SUM(outstanding_balance::numeric), 0)` }).from(loans).where(inArray(loans.status, ['active', 'disbursed']));
      const [shareCapitalTotal] = await db.select({ total: sql<string>`COALESCE(SUM(share_capital::numeric), 0)` }).from(members).where(eq(members.status, 'active'));

      const allAccounts = await db.select().from(saccoAccounts).where(eq(saccoAccounts.isActive, true));

      const assets: any[] = [];
      const liabilities: any[] = [];
      const equity: any[] = [];

      for (const acc of allAccounts) {
        let balance = parseFloat(acc.balance || '0');

        if (acc.accountCode === '2001') balance = parseFloat(savingsTotal?.total || '0');
        else if (acc.accountCode === '1003') balance = parseFloat(loansTotal?.total || '0');
        else if (acc.accountCode === '2002') balance = parseFloat(shareCapitalTotal?.total || '0');

        if (balance === 0) continue;

        const entry = { accountCode: acc.accountCode, accountName: acc.accountName, balance };
        if (acc.accountType === 'asset') assets.push(entry);
        else if (acc.accountType === 'liability') liabilities.push(entry);
        else if (acc.accountType === 'equity') equity.push(entry);
      }

      const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
      const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
      const totalEquity = equity.reduce((s, a) => s + a.balance, 0);

      const revenueAccounts = allAccounts.filter(a => a.accountType === 'revenue');
      const expenseAccounts = allAccounts.filter(a => a.accountType === 'expense');
      const totalRevenue = revenueAccounts.reduce((s, a) => s + parseFloat(a.balance || '0'), 0);
      const totalExpenses = expenseAccounts.reduce((s, a) => s + parseFloat(a.balance || '0'), 0);
      const retainedSurplus = totalRevenue - totalExpenses;

      res.json({
        asOfDate,
        assets: { items: assets, total: totalAssets },
        liabilities: { items: liabilities, total: totalLiabilities },
        equity: {
          items: [
            ...equity,
            ...(retainedSurplus !== 0 ? [{ accountCode: 'RS', accountName: 'Retained Surplus / (Deficit)', balance: retainedSurplus }] : []),
          ],
          total: totalEquity + retainedSurplus,
        },
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity + retainedSurplus,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + retainedSurplus)) < 1,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/income-statement", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const startDate = (req.query.startDate as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];

      const revenueEntries = await db.execute(sql`
        SELECT sa.account_code, sa.account_name,
          COALESCE(SUM(CASE WHEN je.credit_account_id = sa.id THEN je.amount::numeric ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN je.debit_account_id = sa.id THEN je.amount::numeric ELSE 0 END), 0) as net_amount
        FROM sacco_accounts sa
        LEFT JOIN sacco_journal_entries je ON (je.credit_account_id = sa.id OR je.debit_account_id = sa.id) 
          AND je.status = 'posted' AND je.entry_date >= ${startDate} AND je.entry_date <= ${endDate}
        WHERE sa.account_type = 'revenue' AND sa.is_active = true
        GROUP BY sa.id, sa.account_code, sa.account_name
        ORDER BY sa.account_code
      `);

      const expenseEntries = await db.execute(sql`
        SELECT sa.account_code, sa.account_name,
          COALESCE(SUM(CASE WHEN je.debit_account_id = sa.id THEN je.amount::numeric ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN je.credit_account_id = sa.id THEN je.amount::numeric ELSE 0 END), 0) as net_amount
        FROM sacco_accounts sa
        LEFT JOIN sacco_journal_entries je ON (je.debit_account_id = sa.id OR je.credit_account_id = sa.id) 
          AND je.status = 'posted' AND je.entry_date >= ${startDate} AND je.entry_date <= ${endDate}
        WHERE sa.account_type = 'expense' AND sa.is_active = true
        GROUP BY sa.id, sa.account_code, sa.account_name
        ORDER BY sa.account_code
      `);

      const revenueRows = ((revenueEntries as any).rows || revenueEntries).map((r: any) => ({
        accountCode: r.account_code,
        accountName: r.account_name,
        amount: parseFloat(r.net_amount || '0'),
      })).filter((r: any) => r.amount !== 0);

      const expenseRows = ((expenseEntries as any).rows || expenseEntries).map((r: any) => ({
        accountCode: r.account_code,
        accountName: r.account_name,
        amount: parseFloat(r.net_amount || '0'),
      })).filter((r: any) => r.amount !== 0);

      const totalRevenue = revenueRows.reduce((s: number, r: any) => s + r.amount, 0);
      const totalExpenses = expenseRows.reduce((s: number, r: any) => s + r.amount, 0);

      res.json({
        startDate,
        endDate,
        revenue: { items: revenueRows, total: totalRevenue },
        expenses: { items: expenseRows, total: totalExpenses },
        netSurplus: totalRevenue - totalExpenses,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/par-analysis", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const activeLoans = await db.execute(sql`
        SELECT 
          l.id, l.loan_number, l.principal_amount, l.outstanding_balance, l.status, l.loan_type,
          l.due_date, l.disbursement_date, l.term_months, l.member_id,
          m.full_name as member_name, m.member_number
        FROM loans l
        JOIN members m ON m.id = l.member_id
        WHERE l.status IN ('active', 'disbursed') AND l.outstanding_balance::numeric > 1.00
      `);

      const loanRows = (activeLoans as any).rows || activeLoans;
      const now = new Date();
      const totalPortfolio = loanRows.reduce((s: number, l: any) => s + parseFloat(l.outstanding_balance || '0'), 0);

      const parBuckets = {
        current: { count: 0, amount: 0, loans: [] as any[] },
        par1_30: { count: 0, amount: 0, loans: [] as any[] },
        par31_60: { count: 0, amount: 0, loans: [] as any[] },
        par61_90: { count: 0, amount: 0, loans: [] as any[] },
        par91_180: { count: 0, amount: 0, loans: [] as any[] },
        par181_365: { count: 0, amount: 0, loans: [] as any[] },
        par365_plus: { count: 0, amount: 0, loans: [] as any[] },
      };

      for (const loan of loanRows) {
        const outstanding = parseFloat(loan.outstanding_balance || '0');
        let daysOverdue = 0;

        if (loan.due_date) {
          const dueDate = new Date(loan.due_date);
          if (now > dueDate) {
            daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        const loanEntry = {
          loanNumber: loan.loan_number,
          memberName: loan.member_name,
          memberNumber: loan.member_number,
          loanType: loan.loan_type,
          principalAmount: parseFloat(loan.principal_amount),
          outstandingBalance: outstanding,
          daysOverdue,
        };

        if (daysOverdue === 0) { parBuckets.current.count++; parBuckets.current.amount += outstanding; parBuckets.current.loans.push(loanEntry); }
        else if (daysOverdue <= 30) { parBuckets.par1_30.count++; parBuckets.par1_30.amount += outstanding; parBuckets.par1_30.loans.push(loanEntry); }
        else if (daysOverdue <= 60) { parBuckets.par31_60.count++; parBuckets.par31_60.amount += outstanding; parBuckets.par31_60.loans.push(loanEntry); }
        else if (daysOverdue <= 90) { parBuckets.par61_90.count++; parBuckets.par61_90.amount += outstanding; parBuckets.par61_90.loans.push(loanEntry); }
        else if (daysOverdue <= 180) { parBuckets.par91_180.count++; parBuckets.par91_180.amount += outstanding; parBuckets.par91_180.loans.push(loanEntry); }
        else if (daysOverdue <= 365) { parBuckets.par181_365.count++; parBuckets.par181_365.amount += outstanding; parBuckets.par181_365.loans.push(loanEntry); }
        else { parBuckets.par365_plus.count++; parBuckets.par365_plus.amount += outstanding; parBuckets.par365_plus.loans.push(loanEntry); }
      }

      const atRiskAmount = parBuckets.par1_30.amount + parBuckets.par31_60.amount + parBuckets.par61_90.amount +
        parBuckets.par91_180.amount + parBuckets.par181_365.amount + parBuckets.par365_plus.amount;

      res.json({
        totalPortfolio,
        totalLoans: loanRows.length,
        atRiskAmount,
        parRate: totalPortfolio > 0 ? ((atRiskAmount / totalPortfolio) * 100).toFixed(2) : '0.00',
        par30: totalPortfolio > 0 ? (((parBuckets.par31_60.amount + parBuckets.par61_90.amount + parBuckets.par91_180.amount + parBuckets.par181_365.amount + parBuckets.par365_plus.amount) / totalPortfolio) * 100).toFixed(2) : '0.00',
        par60: totalPortfolio > 0 ? (((parBuckets.par61_90.amount + parBuckets.par91_180.amount + parBuckets.par181_365.amount + parBuckets.par365_plus.amount) / totalPortfolio) * 100).toFixed(2) : '0.00',
        par90: totalPortfolio > 0 ? (((parBuckets.par91_180.amount + parBuckets.par181_365.amount + parBuckets.par365_plus.amount) / totalPortfolio) * 100).toFixed(2) : '0.00',
        buckets: parBuckets,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/run-provisioning", isAuthenticated, requireRole('admin', 'treasurer'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;

      const activeLoans = await db.execute(sql`
        SELECT l.id, l.member_id, l.outstanding_balance, l.due_date, l.status
        FROM loans l
        WHERE l.status IN ('active', 'disbursed') AND l.outstanding_balance::numeric > 1.00
      `);

      const loanRows = (activeLoans as any).rows || activeLoans;
      const now = new Date();
      const provisionDate = now.toISOString().split('T')[0];

      let totalProvision = 0;
      const summary = { current: 0, watch: 0, substandard: 0, doubtful: 0, loss: 0 };
      const provisionRows: any[] = [];

      for (const loan of loanRows) {
        const outstanding = parseFloat(loan.outstanding_balance || '0');
        let daysOverdue = 0;

        if (loan.due_date) {
          const dueDate = new Date(loan.due_date);
          if (now > dueDate) {
            daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        let category: string;
        let rate: number;
        if (daysOverdue <= 30) { category = 'current'; rate = 1; }
        else if (daysOverdue <= 90) { category = 'watch'; rate = 5; }
        else if (daysOverdue <= 180) { category = 'substandard'; rate = 25; }
        else if (daysOverdue <= 365) { category = 'doubtful'; rate = 50; }
        else { category = 'loss'; rate = 100; }

        const provisionAmount = (outstanding * rate) / 100;
        totalProvision += provisionAmount;
        summary[category as keyof typeof summary]++;

        provisionRows.push({
          loanId: loan.id,
          memberId: loan.member_id,
          outstandingBalance: outstanding.toFixed(2),
          daysOverdue,
          category: category as any,
          provisionRate: rate.toFixed(2),
          provisionAmount: provisionAmount.toFixed(2),
          provisionDate,
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(loanProvisions);
        for (const row of provisionRows) {
          await tx.insert(loanProvisions).values(row);
        }
      });

      res.json({
        message: 'Provisioning completed',
        totalLoans: loanRows.length,
        totalProvision,
        summary,
        provisionDate,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/provisioning-summary", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const provisions = await db.execute(sql`
        SELECT 
          category,
          provision_rate,
          COUNT(*) as loan_count,
          SUM(outstanding_balance::numeric) as total_outstanding,
          SUM(provision_amount::numeric) as total_provision
        FROM loan_provisions
        GROUP BY category, provision_rate
        ORDER BY provision_rate
      `);

      const rows = (provisions as any).rows || provisions;

      const lastProvision = await db.execute(sql`
        SELECT MAX(provision_date) as last_date FROM loan_provisions
      `);
      const lastDate = ((lastProvision as any).rows || lastProvision)[0]?.last_date;

      res.json({
        lastProvisionDate: lastDate,
        categories: rows.map((r: any) => ({
          category: r.category,
          provisionRate: parseFloat(r.provision_rate),
          loanCount: parseInt(r.loan_count),
          totalOutstanding: parseFloat(r.total_outstanding || '0'),
          totalProvision: parseFloat(r.total_provision || '0'),
        })),
        totalProvision: rows.reduce((s: number, r: any) => s + parseFloat(r.total_provision || '0'), 0),
        totalOutstanding: rows.reduce((s: number, r: any) => s + parseFloat(r.total_outstanding || '0'), 0),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/loans/:id/write-off", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const loanId = parseInt(req.params.id);
      const { reason } = req.body;

      if (!reason) return res.status(400).json({ message: 'Write-off reason is required' });

      const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
      if (!loan) return res.status(404).json({ message: 'Loan not found' });
      if (!['active', 'disbursed', 'defaulted'].includes(loan.status || '')) {
        return res.status(400).json({ message: 'Only active, disbursed, or defaulted loans can be written off' });
      }

      const existing = await db.select().from(loanWriteoffs)
        .where(and(eq(loanWriteoffs.loanId, loanId), eq(loanWriteoffs.status, 'pending')));
      if (existing.length > 0) return res.status(400).json({ message: 'A pending write-off request already exists for this loan' });

      const [writeoff] = await db.insert(loanWriteoffs).values({
        loanId,
        memberId: loan.memberId,
        loanNumber: loan.loanNumber,
        principalAmount: loan.principalAmount,
        outstandingBalance: loan.outstandingBalance,
        writeoffAmount: loan.outstandingBalance,
        reason,
        status: 'pending',
        requestedBy: userId!,
      }).returning();

      res.json(writeoff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/loan-writeoffs", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const writeoffs = await db.execute(sql`
        SELECT lw.*, m.full_name as member_name, m.member_number,
          u1.first_name || ' ' || u1.last_name as requested_by_name,
          u2.first_name || ' ' || u2.last_name as approved_by_name
        FROM loan_writeoffs lw
        JOIN members m ON m.id = lw.member_id
        JOIN users u1 ON u1.id = lw.requested_by
        LEFT JOIN users u2 ON u2.id = lw.approved_by
        ORDER BY lw.created_at DESC
      `);
      res.json((writeoffs as any).rows || writeoffs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/loan-writeoffs/:id/approve", isAuthenticated, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const writeoffId = parseInt(req.params.id);

      const [writeoff] = await db.select().from(loanWriteoffs).where(eq(loanWriteoffs.id, writeoffId));
      if (!writeoff) return res.status(404).json({ message: 'Write-off not found' });
      if (writeoff.status !== 'pending') return res.status(400).json({ message: 'Write-off is not pending' });

      await db.transaction(async (tx) => {
        await tx.update(loanWriteoffs).set({
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        }).where(eq(loanWriteoffs.id, writeoffId));

        await tx.update(loans).set({
          status: 'defaulted',
          outstandingBalance: '0.00',
        }).where(eq(loans.id, writeoff.loanId));

        let loanLossAccount = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.accountCode, '5011'));
        if (loanLossAccount.length === 0) {
          loanLossAccount = await tx.insert(saccoAccounts).values({
            accountCode: '5011', accountName: 'Loan Loss / Write-Off', accountType: 'expense', balance: '0.00', isActive: true,
          }).returning();
        }
        const loanPortfolioAccount = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.accountCode, '1003'));

        if (loanLossAccount.length > 0 && loanPortfolioAccount.length > 0) {
          await tx.insert(saccoJournalEntries).values({
            entryNumber: `WO-${Date.now()}`,
            entryDate: new Date().toISOString().split('T')[0],
            description: `Loan write-off: ${writeoff.loanNumber}`,
            debitAccountId: loanLossAccount[0].id,
            creditAccountId: loanPortfolioAccount[0].id,
            amount: writeoff.writeoffAmount || writeoff.outstandingBalance,
            reference: `writeoff:${writeoff.loanId}`,
            status: 'posted',
            createdBy: userId!,
          });
        }
      });

      res.json({ message: 'Loan written off successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/loan-writeoffs/:id/reject", isAuthenticated, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const writeoffId = parseInt(req.params.id);
      const { reason } = req.body;

      await db.update(loanWriteoffs).set({
        status: 'rejected',
        rejectionReason: reason || 'Rejected',
        approvedBy: userId,
        approvedAt: new Date(),
      }).where(eq(loanWriteoffs.id, writeoffId));

      res.json({ message: 'Write-off request rejected' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/financial-years", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const years = await db.select().from(financialYears).orderBy(desc(financialYears.id));
      res.json(years);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/dividends/calculate", isAuthenticated, requireRole('admin', 'treasurer'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const { financialYearId, dividendRate, notes } = req.body;

      if (!financialYearId || !dividendRate) return res.status(400).json({ message: 'Financial year and dividend rate are required' });

      const [fy] = await db.select().from(financialYears).where(eq(financialYears.id, parseInt(financialYearId)));
      if (!fy) return res.status(404).json({ message: 'Financial year not found' });

      const existingDist = await db.select().from(dividendDistributions)
        .where(and(eq(dividendDistributions.financialYearId, parseInt(financialYearId)), inArray(dividendDistributions.status, ['draft', 'approved'])));
      if (existingDist.length > 0) return res.status(400).json({ message: 'A dividend distribution already exists for this financial year. Delete or distribute it first.' });

      const revenueResult = await db.execute(sql`
        SELECT COALESCE(SUM(CASE WHEN sa.account_type = 'revenue' THEN sa.balance::numeric ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN sa.account_type = 'expense' THEN sa.balance::numeric ELSE 0 END), 0) as total_expenses
        FROM sacco_accounts sa WHERE sa.is_active = true
      `);
      const revRow = ((revenueResult as any).rows || revenueResult)[0];
      const totalSurplus = parseFloat(revRow?.total_revenue || '0') - parseFloat(revRow?.total_expenses || '0');

      const activeMembers = await db.execute(sql`
        SELECT id, full_name, member_number, share_capital, number_of_shares
        FROM members WHERE status = 'active' AND share_capital::numeric > 0
      `);
      const memberRows = (activeMembers as any).rows || activeMembers;

      const totalShares = memberRows.reduce((s: number, m: any) => s + parseFloat(m.share_capital || '0'), 0);
      const rate = parseFloat(dividendRate);
      const totalDividendAmount = (totalShares * rate) / 100;

      const [distribution] = await db.insert(dividendDistributions).values({
        financialYearId: parseInt(financialYearId),
        totalSurplus: totalSurplus.toFixed(2),
        dividendRate: (rate / 100).toFixed(4),
        totalDividendAmount: totalDividendAmount.toFixed(2),
        totalShares: totalShares.toFixed(2),
        status: 'draft',
        calculatedBy: userId!,
        notes: notes || null,
      }).returning();

      for (const member of memberRows) {
        const memberShareCapital = parseFloat(member.share_capital || '0');
        const shares = parseInt(member.number_of_shares || '0');
        const memberDividend = (memberShareCapital * rate) / 100;

        if (memberDividend > 0) {
          await db.insert(memberDividends).values({
            distributionId: distribution.id,
            memberId: member.id,
            shareCapital: memberShareCapital.toFixed(2),
            numberOfShares: shares,
            dividendAmount: memberDividend.toFixed(2),
            paymentMethod: 'credit_to_savings',
            status: 'pending',
          });
        }
      }

      res.json({
        distribution,
        memberCount: memberRows.length,
        totalShares,
        totalDividendAmount,
        totalSurplus,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dividends", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const distributions = await db.execute(sql`
        SELECT dd.*, fy.year_label,
          u1.first_name || ' ' || u1.last_name as calculated_by_name,
          u2.first_name || ' ' || u2.last_name as approved_by_name,
          (SELECT COUNT(*) FROM member_dividends md WHERE md.distribution_id = dd.id) as member_count,
          (SELECT COUNT(*) FROM member_dividends md WHERE md.distribution_id = dd.id AND md.status = 'paid') as paid_count
        FROM dividend_distributions dd
        JOIN financial_years fy ON fy.id = dd.financial_year_id
        JOIN users u1 ON u1.id = dd.calculated_by
        LEFT JOIN users u2 ON u2.id = dd.approved_by
        ORDER BY dd.created_at DESC
      `);
      res.json((distributions as any).rows || distributions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dividends/:id/members", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const distId = parseInt(req.params.id);
      const memberDivs = await db.execute(sql`
        SELECT md.*, m.full_name, m.member_number
        FROM member_dividends md
        JOIN members m ON m.id = md.member_id
        WHERE md.distribution_id = ${distId}
        ORDER BY md.dividend_amount DESC
      `);
      res.json((memberDivs as any).rows || memberDivs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/dividends/:id/approve", isAuthenticated, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      const distId = parseInt(req.params.id);

      const [dist] = await db.select().from(dividendDistributions).where(eq(dividendDistributions.id, distId));
      if (!dist) return res.status(404).json({ message: 'Distribution not found' });
      if (dist.status !== 'draft') return res.status(400).json({ message: 'Only draft distributions can be approved' });

      await db.update(dividendDistributions).set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      }).where(eq(dividendDistributions.id, distId));

      res.json({ message: 'Dividend distribution approved' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/dividends/:id/distribute", isAuthenticated, requireRole('admin', 'treasurer'), async (req: Request, res: Response) => {
    try {
      const distId = parseInt(req.params.id);

      const [dist] = await db.select().from(dividendDistributions).where(eq(dividendDistributions.id, distId));
      if (!dist) return res.status(404).json({ message: 'Distribution not found' });
      if (dist.status !== 'approved') return res.status(400).json({ message: 'Distribution must be approved before distributing' });

      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;

      const pendingDividends = await db.select().from(memberDividends)
        .where(and(eq(memberDividends.distributionId, distId), eq(memberDividends.status, 'pending')));

      let distributed = 0;
      await db.transaction(async (tx) => {
        const retainedEarningsAcc = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.accountCode, '3001'));
        const memberSavingsAcc = await tx.select().from(saccoAccounts).where(eq(saccoAccounts.accountCode, '2001'));

        for (const div of pendingDividends) {
          if (div.paymentMethod === 'credit_to_savings') {
            const [savingsAcc] = await tx.select().from(savingsAccountsTable)
              .where(eq(savingsAccountsTable.memberId, div.memberId));
            if (savingsAcc) {
              const newBalance = parseFloat(savingsAcc.balance) + parseFloat(div.dividendAmount);
              await tx.update(savingsAccountsTable).set({
                balance: newBalance.toFixed(2),
              }).where(eq(savingsAccountsTable.id, savingsAcc.id));

              await tx.update(members).set({
                totalSavings: sql`(SELECT COALESCE(SUM(balance::numeric), 0) FROM savings_accounts WHERE member_id = ${div.memberId})`,
              }).where(eq(members.id, div.memberId));
            }
          }

          await tx.update(memberDividends).set({
            status: 'paid',
            paidAt: new Date(),
          }).where(eq(memberDividends.id, div.id));
          distributed++;

          if (retainedEarningsAcc.length > 0 && memberSavingsAcc.length > 0) {
            await tx.insert(saccoJournalEntries).values({
              entryNumber: `DIV-${dist.id}-${div.memberId}-${Date.now()}`,
              entryDate: new Date().toISOString().split('T')[0],
              description: `Dividend distribution - Member ID: ${div.memberId}`,
              debitAccountId: retainedEarningsAcc[0].id,
              creditAccountId: memberSavingsAcc[0].id,
              amount: div.dividendAmount,
              reference: `dividend:${dist.id}`,
              status: 'posted',
              createdBy: userId!,
            });
          }
        }

        await tx.update(dividendDistributions).set({
          status: 'distributed',
          distributedAt: new Date(),
        }).where(eq(dividendDistributions.id, distId));
      });

      res.json({ message: `Dividends distributed to ${distributed} members` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/dividends/:id", isAuthenticated, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const distId = parseInt(req.params.id);
      const [dist] = await db.select().from(dividendDistributions).where(eq(dividendDistributions.id, distId));
      if (!dist) return res.status(404).json({ message: 'Distribution not found' });
      if (dist.status === 'distributed') return res.status(400).json({ message: 'Cannot delete a distributed dividend' });

      await db.transaction(async (tx) => {
        await tx.delete(memberDividends).where(eq(memberDividends.distributionId, distId));
        await tx.delete(dividendDistributions).where(eq(dividendDistributions.id, distId));
      });

      res.json({ message: 'Distribution deleted' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/loans/:id/restructure", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const loanId = parseInt(req.params.id);
      const { newRate, newTerm, reason } = req.body;

      if (!newRate || !newTerm || !reason || !String(reason).trim()) {
        return res.status(400).json({ message: 'New interest rate, term, and reason are required' });
      }

      const rate = parseFloat(newRate);
      const term = parseInt(newTerm);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ message: 'Interest rate must be between 0 and 100' });
      }
      if (!Number.isFinite(term) || term < 1 || term > 360) {
        return res.status(400).json({ message: 'Term must be between 1 and 360 months' });
      }
      if (isNaN(loanId)) {
        return res.status(400).json({ message: 'Invalid loan ID' });
      }

      const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
      if (!loan) return res.status(404).json({ message: 'Loan not found' });

      if (!['active', 'disbursed', 'defaulted'].includes(loan.status)) {
        return res.status(400).json({ message: 'Only active, disbursed, or defaulted loans can be restructured' });
      }

      const existing = await db.select().from(loanRestructures)
        .where(and(eq(loanRestructures.loanId, loanId), eq(loanRestructures.status, 'pending')));
      if (existing.length > 0) {
        return res.status(400).json({ message: 'A pending restructure request already exists for this loan' });
      }

      const balance = parseFloat(loan.outstandingBalance);
      const decimalRate = rate / 100;
      const monthlyRate = decimalRate / 12;
      let newMonthlyPayment: number;
      if (monthlyRate > 0) {
        newMonthlyPayment = Math.ceil(balance * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1));
      } else {
        newMonthlyPayment = Math.ceil(balance / term);
      }

      const [restructure] = await db.insert(loanRestructures).values({
        loanId,
        memberId: loan.memberId,
        loanNumber: loan.loanNumber,
        originalPrincipal: loan.principalAmount,
        originalRate: loan.interestRate,
        originalTerm: loan.termMonths,
        originalMonthlyPayment: loan.monthlyPayment,
        originalBalance: loan.outstandingBalance,
        newRate: decimalRate.toFixed(4),
        newTerm: term,
        newMonthlyPayment: newMonthlyPayment.toString(),
        reason,
        requestedBy: userId,
      }).returning();

      res.json(restructure);
    } catch (error: any) {
      console.error("Error creating restructure request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/loan-restructures", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const restructures = await db.execute(sql`
        SELECT lr.*, m.full_name as member_name, m.member_number
        FROM loan_restructures lr
        JOIN members m ON m.id = lr.member_id
        ORDER BY lr.created_at DESC
      `);
      res.json((restructures as any).rows || restructures);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/loans/:id/restructure-history", isAuthenticated, requireRole('admin', 'treasurer', 'committee'), async (req: Request, res: Response) => {
    try {
      const loanId = parseInt(req.params.id);
      const history = await db.select().from(loanRestructures)
        .where(eq(loanRestructures.loanId, loanId))
        .orderBy(desc(loanRestructures.createdAt));
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/loan-restructures/:id/approve", isAuthenticated, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const restructureId = parseInt(req.params.id);

      const [restructure] = await db.select().from(loanRestructures).where(eq(loanRestructures.id, restructureId));
      if (!restructure) return res.status(404).json({ message: 'Restructure request not found' });
      if (restructure.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });

      await db.transaction(async (tx) => {
        await tx.update(loanRestructures).set({
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        }).where(eq(loanRestructures.id, restructureId));

        await tx.update(loans).set({
          interestRate: restructure.newRate,
          termMonths: restructure.newTerm,
          monthlyPayment: restructure.newMonthlyPayment,
        }).where(eq(loans.id, restructure.loanId));
      });

      res.json({ message: 'Restructure approved and new terms applied to the loan' });
    } catch (error: any) {
      console.error("Error approving restructure:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/loan-restructures/:id/reject", isAuthenticated, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const restructureId = parseInt(req.params.id);
      const { reason } = req.body;

      const [restructure] = await db.select().from(loanRestructures).where(eq(loanRestructures.id, restructureId));
      if (!restructure) return res.status(404).json({ message: 'Restructure request not found' });
      if (restructure.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });

      await db.update(loanRestructures).set({
        status: 'rejected',
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: reason || 'Rejected by admin',
      }).where(eq(loanRestructures.id, restructureId));

      res.json({ message: 'Restructure request rejected' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
