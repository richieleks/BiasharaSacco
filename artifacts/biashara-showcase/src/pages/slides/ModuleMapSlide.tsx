export default function ModuleMapSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          03 / 15
        </span>
      </div>

      <div className="absolute top-[10vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module map
            </span>
          </div>
          <h1 className="mt-[2vh] text-[4.8vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            Ten modules. <span className="text-primary">One workflow.</span>
          </h1>
        </div>
        <p className="max-w-[28vw] text-[1.5vw] font-light leading-snug text-text/70 text-pretty pb-[1vh]">
          Each tile maps to a section of the app, accessible to the right people
          through fine-grained roles and permissions.
        </p>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[42vh] bottom-[10vh] grid grid-cols-5 grid-rows-2 gap-[1.2vw]">
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Dashboard</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Role-based metrics</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
              <circle cx="17" cy="6" r="2.5" />
              <path d="M22 18c0-2.5-2-4.5-5-4.5" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Members</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Profiles &amp; status</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-accent/15">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-accent)' }}>
              <path d="M3 13c0-4 3-7 8-7s8 3 8 7v3c0 2-1 3-3 3H6c-2 0-3-1-3-3z" />
              <circle cx="15" cy="13" r="1.2" fill="currentColor" />
              <path d="M11 6V4" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Savings</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Deposits, withdrawals</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 9h10M7 13h10M7 17h6" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Loans</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Full lifecycle</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-warning/15">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-warning)' }}>
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Guarantors</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Request &amp; approve</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-accent/15">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-accent)' }}>
              <path d="M3 7l4-4 4 4" />
              <path d="M7 3v12" />
              <path d="M21 17l-4 4-4-4" />
              <path d="M17 21V9" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Transactions</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Unified ledger</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Share Capital</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Equity &amp; dividends</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
              <path d="M4 20V10M10 20V4M16 20v-8M22 20v-5" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Reports</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Analytics &amp; audits</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-warning/15">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-warning)' }}>
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M4 17v2c0 1 1 2 2 2h12c1 0 2-1 2-2v-2" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Data Import</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Granular per type</div>
          </div>
        </div>

        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
          <div className="flex h-[5vh] w-[5vh] items-center justify-center rounded-[0.6vh] bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-[3vh] w-[3vh]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <path d="M12 8v4M12 15h.01" />
            </svg>
          </div>
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink leading-tight">Roles &amp; Access</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60 leading-snug">Fine-grained RBAC</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>The map</span>
        <span>What we&#8217;ll cover</span>
      </div>
    </div>
  );
}
