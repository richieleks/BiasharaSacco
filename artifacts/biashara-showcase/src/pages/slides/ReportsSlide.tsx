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

      <div className="absolute left-[6vw] right-[6vw] top-[50vh] bottom-[8vh] grid grid-cols-3 grid-rows-2 gap-[1.2vw]">
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-warning">Risk</div>
          <div>
            <div className="text-[2vw] font-extrabold leading-tight text-ink">Dormant detection</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Flag members who stopped saving.</div>
          </div>
        </div>
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-accent">Reconciliation</div>
          <div>
            <div className="text-[2vw] font-extrabold leading-tight text-ink">Bank schedules</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Match records to bank statements.</div>
          </div>
        </div>
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Compliance</div>
          <div>
            <div className="text-[2vw] font-extrabold leading-tight text-ink">Financial statements</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Income, balance, position.</div>
          </div>
        </div>
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Activity</div>
          <div>
            <div className="text-[2vw] font-extrabold leading-tight text-ink">Member activity</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Saving and borrowing patterns.</div>
          </div>
        </div>
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Loans</div>
          <div>
            <div className="text-[2vw] font-extrabold leading-tight text-ink">Portfolio &amp; arrears</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Balances, health and aging.</div>
          </div>
        </div>
        <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Trail</div>
          <div>
            <div className="text-[2vw] font-extrabold leading-tight text-ink">Audit logs</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Searchable, by record and actor.</div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-[6vw] bottom-[3vh] h-[1vh] bg-gradient-to-t from-bg to-transparent" />

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Reports</span>
        <span>Six report families</span>
      </div>
    </div>
  );
}
