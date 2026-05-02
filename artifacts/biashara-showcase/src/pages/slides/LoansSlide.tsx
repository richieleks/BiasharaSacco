export default function LoansSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          07 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module 04 · Loans
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            From application
            <span className="block text-primary">to final repayment.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 9h10M7 13h10M7 17h6" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[50vh] bottom-[10vh]">
        <div className="grid grid-cols-5 gap-[1.2vw]">
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh]">
            <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Step 01</div>
            <div className="mt-[0.8vh] text-[1.8vw] font-extrabold leading-tight text-ink">Apply</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Member submits with documents.</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh]">
            <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Step 02</div>
            <div className="mt-[0.8vh] text-[1.8vw] font-extrabold leading-tight text-ink">Guarantee</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Invited; accept or decline.</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh]">
            <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Step 03</div>
            <div className="mt-[0.8vh] text-[1.8vw] font-extrabold leading-tight text-ink">Approve</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Reviewed by committee.</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh]">
            <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-primary">Step 04</div>
            <div className="mt-[0.8vh] text-[1.8vw] font-extrabold leading-tight text-ink">Disburse</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Funds out; schedule set.</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.6vh]">
            <div className="text-[1.5vw] font-semibold tracking-[0.2em] uppercase text-accent">Step 05</div>
            <div className="mt-[0.8vh] text-[1.8vw] font-extrabold leading-tight text-ink">Repay</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Tracked to the schedule.</div>
          </div>
        </div>
        <div className="mt-[2vh] grid grid-cols-3 gap-[1.2vw]">
          <div className="rounded-[1vh] border border-primary/20 bg-primary/5 px-[1.4vw] py-[1.4vh]">
            <div className="text-[1.6vw] font-semibold text-ink leading-tight">New loans &amp; top-ups</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70 leading-snug">Each with its own approval path.</div>
          </div>
          <div className="rounded-[1vh] border border-primary/20 bg-primary/5 px-[1.4vw] py-[1.4vh]">
            <div className="text-[1.6vw] font-semibold text-ink leading-tight">Document uploads</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70 leading-snug">Payslips and IDs on every file.</div>
          </div>
          <div className="rounded-[1vh] border border-primary/20 bg-primary/5 px-[1.4vw] py-[1.4vh]">
            <div className="text-[1.6vw] font-semibold text-ink leading-tight">Amortization schedules</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70 leading-snug">Generated for every active loan.</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Loans</span>
        <span>Five-step lifecycle</span>
      </div>
    </div>
  );
}
