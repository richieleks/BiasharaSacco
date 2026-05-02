export default function DashboardSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          04 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module 01 · Dashboard
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.6vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            The numbers that
            <span className="block text-primary">matter, on arrival.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[12vh] grid grid-cols-2 gap-[2vw]">
        <div className="flex flex-col gap-[2.4vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Role-aware home screen</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">A treasurer, an admin and a member each land on a different view.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Live financial pulse</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Total savings, outstanding loans, share capital — refreshed in real time.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Quick actions</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Record a deposit, log a repayment or open a member file in one click.</div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.4vh] bg-surface border border-text/5 p-[3vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-text/50">
            At a glance
          </div>
          <div>
            <div className="text-[5.6vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
              360°
            </div>
            <div className="mt-[1.2vh] text-[1.5vw] font-light leading-snug text-text/70 text-pretty">
              of the SACCO&#8217;s health visible on a single screen — savings,
              credit, members and pending approvals.
            </div>
          </div>
          <div className="flex items-center gap-[1vw] text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-primary">
            <span className="block h-[0.4vh] w-[3vw] bg-primary" />
            Built for daily use
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Dashboard</span>
        <span>Start here</span>
      </div>
    </div>
  );
}
