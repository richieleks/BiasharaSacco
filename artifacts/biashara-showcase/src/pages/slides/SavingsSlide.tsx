export default function SavingsSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          06 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-accent" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">
              Module 03 · Savings
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.6vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            Every shilling
            <span className="block text-accent">accounted for.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-accent/15">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-accent)' }}>
            <path d="M3 13c0-4 3-7 8-7s8 3 8 7v3c0 2-1 3-3 3H6c-2 0-3-1-3-3z" />
            <circle cx="15" cy="13" r="1.2" fill="currentColor" />
            <path d="M11 6V4" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[12vh] grid grid-cols-12 gap-[2vw]">
        <div className="col-span-7 flex flex-col gap-[2.4vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Deposits &amp; withdrawals</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Recorded against the right account, with a clear running balance.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Account statements</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Generated on demand for any member, any date range.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Three account types</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Regular savings, fixed deposits and group accounts — each with its own rules.</div>
            </div>
          </div>
        </div>

        <div className="col-span-5 grid grid-cols-1 gap-[1.4vh]">
          <div className="rounded-[1vh] bg-surface border border-accent/30 p-[2vh] flex items-center justify-between">
            <div>
              <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-accent">Total on book</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70">Live, across all accounts</div>
            </div>
            <div className="text-[2.4vw] font-extrabold text-ink tabular-nums">UGX 899,889,012</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[2vh] flex items-center justify-between">
            <div>
              <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-accent">Regular</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70">Day-to-day deposits</div>
            </div>
            <div className="text-[2.4vw] font-extrabold text-ink tabular-nums">01</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[2vh] flex items-center justify-between">
            <div>
              <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-accent">Fixed &amp; Group</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70">Term deposits, chama / merry-go-round</div>
            </div>
            <div className="text-[2.4vw] font-extrabold text-ink tabular-nums">02·03</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Savings · Live from Biashara SACCO tenant</span>
        <span>Three account types</span>
      </div>
    </div>
  );
}
