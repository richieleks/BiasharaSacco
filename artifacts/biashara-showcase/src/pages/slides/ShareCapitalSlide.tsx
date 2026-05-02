export default function ShareCapitalSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          10 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module 07 · Share Capital
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            Member equity,
            <span className="block text-primary">tracked to the cent.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[12vh] grid grid-cols-12 gap-[2vw]">
        <div className="col-span-7 flex flex-col gap-[2.4vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Equity by member</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Shares purchased, transferred and held — visible per member, per period.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Dividend distribution</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Calculated from holdings and posted in a single, auditable run.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Statements on demand</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Members can see contributions and dividends in their own profile.</div>
            </div>
          </div>
        </div>

        <div className="col-span-5 rounded-[1.4vh] bg-surface border border-text/5 p-[2.4vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-text/55">
            Dividend run
          </div>
          <div>
            <div className="text-[6vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
              1 click
            </div>
            <div className="mt-[1.2vh] text-[1.5vw] font-light leading-snug text-text/70 text-pretty">
              from declared rate to per-member allocations posted across the
              entire register.
            </div>
          </div>
          <div className="flex items-center gap-[1vw] text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-primary">
            <span className="block h-[0.4vh] w-[3vw] bg-primary" />
            Auditable end to end
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Share Capital</span>
        <span>Equity, tracked</span>
      </div>
    </div>
  );
}
