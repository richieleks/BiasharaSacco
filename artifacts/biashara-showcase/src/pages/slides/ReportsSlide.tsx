const base = import.meta.env.BASE_URL;

export default function ReportsSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          11 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module 08 · Reports
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            Decisions backed
            <span className="block text-primary">by real numbers.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
            <path d="M4 20V10M10 20V4M16 20v-8M22 20v-5" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[50vh] bottom-[8vh] grid grid-cols-12 gap-[1.4vw]">
        <div className="col-span-5 grid grid-cols-2 gap-[1vh] content-start">
          <div className="rounded-[0.8vh] bg-surface border border-text/5 p-[1vh]">
            <div className="text-[1.1vw] font-semibold tracking-[0.2em] uppercase text-primary">Members</div>
            <div className="mt-[0.2vh] text-[1.3vw] font-extrabold text-ink leading-tight">Roster &amp; status</div>
          </div>
          <div className="rounded-[0.8vh] bg-surface border border-text/5 p-[1vh]">
            <div className="text-[1.1vw] font-semibold tracking-[0.2em] uppercase text-accent">Savings</div>
            <div className="mt-[0.2vh] text-[1.3vw] font-extrabold text-ink leading-tight">Balances summary</div>
          </div>
          <div className="rounded-[0.8vh] bg-surface border border-text/5 p-[1vh]">
            <div className="text-[1.1vw] font-semibold tracking-[0.2em] uppercase text-primary">Loans</div>
            <div className="mt-[0.2vh] text-[1.3vw] font-extrabold text-ink leading-tight">Portfolio &amp; arrears</div>
          </div>
          <div className="rounded-[0.8vh] bg-surface border border-text/5 p-[1vh]">
            <div className="text-[1.1vw] font-semibold tracking-[0.2em] uppercase text-primary">Compliance</div>
            <div className="mt-[0.2vh] text-[1.3vw] font-extrabold text-ink leading-tight">Financial stmts.</div>
          </div>
          <div className="rounded-[0.8vh] bg-surface border border-text/5 p-[1vh]">
            <div className="text-[1.1vw] font-semibold tracking-[0.2em] uppercase text-warning">Risk</div>
            <div className="mt-[0.2vh] text-[1.3vw] font-extrabold text-ink leading-tight">Dormant &amp; PAR</div>
          </div>
          <div className="rounded-[0.8vh] bg-surface border border-text/5 p-[1vh]">
            <div className="text-[1.1vw] font-semibold tracking-[0.2em] uppercase text-primary">Trail</div>
            <div className="mt-[0.2vh] text-[1.3vw] font-extrabold text-ink leading-tight">Audit logs</div>
          </div>
          <div className="col-span-2 rounded-[0.8vh] border border-accent/30 bg-accent/5 px-[1vw] py-[1vh]">
            <div className="text-[1.3vw] font-semibold text-ink leading-tight tabular-nums">
              Live tenant: 371 members · UGX 899,889,012 · 100% repayment
            </div>
          </div>
        </div>

        <div className="col-span-7 rounded-[1.2vh] border border-text/10 bg-surface p-[1vh] overflow-hidden flex flex-col gap-[0.8vh]">
          <div className="flex items-center justify-between px-[0.6vw]">
            <span className="text-[1.1vw] font-semibold tracking-[0.3em] uppercase text-text/50">Reports &amp; Analytics</span>
            <span className="text-[1.1vw] font-light tracking-[0.2em] uppercase text-primary">Live screen</span>
          </div>
          <div className="flex-1 overflow-hidden rounded-[0.8vh] border border-text/10 bg-bg">
            <img
              src={`${base}screens/reports.png`}
              alt="Reports & Analytics screen with member, savings, loan, financial, transaction and audit reports"
              className="block h-full w-full object-cover object-top"
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-[6vw] bottom-[3vh] h-[1vh] bg-gradient-to-t from-bg to-transparent" />

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Reports · Captured from the running app</span>
        <span>Six report families</span>
      </div>
    </div>
  );
}
