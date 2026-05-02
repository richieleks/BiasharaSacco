export default function GuarantorsSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          08 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-warning" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-warning">
              Module 05 · Guarantors
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            Trust, recorded
            <span className="block text-warning">and verifiable.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-warning/15">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-warning)' }}>
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[12vh] grid grid-cols-12 gap-[2vw]">
        <div className="col-span-7 flex flex-col gap-[2.4vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-warning shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Request &amp; respond</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Borrowers nominate guarantors; each one accepts or declines in their own dashboard.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-warning shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Linked to the loan file</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Status, exposure and acceptance date sit alongside the loan record.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-warning shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Notifications, not phone calls</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">In-app alerts replace the back-and-forth that used to slow approvals.</div>
            </div>
          </div>
        </div>

        <div className="col-span-5 rounded-[1.4vh] bg-surface border border-text/5 p-[2.4vh] flex flex-col justify-between">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-warning">Flow</div>
          <div className="flex flex-col gap-[1.6vh]">
            <div className="flex items-center gap-[1vw]">
              <div className="flex h-[4vh] w-[4vh] items-center justify-center rounded-full bg-warning text-bg text-[1.5vw] font-extrabold tabular-nums">1</div>
              <div className="text-[1.5vw] font-semibold text-ink">Borrower nominates</div>
            </div>
            <div className="flex items-center gap-[1vw]">
              <div className="flex h-[4vh] w-[4vh] items-center justify-center rounded-full bg-warning text-bg text-[1.5vw] font-extrabold tabular-nums">2</div>
              <div className="text-[1.5vw] font-semibold text-ink">Guarantor reviews</div>
            </div>
            <div className="flex items-center gap-[1vw]">
              <div className="flex h-[4vh] w-[4vh] items-center justify-center rounded-full bg-accent text-bg text-[1.5vw] font-extrabold tabular-nums">3</div>
              <div className="text-[1.5vw] font-semibold text-ink">Accept or decline</div>
            </div>
            <div className="flex items-center gap-[1vw]">
              <div className="flex h-[4vh] w-[4vh] items-center justify-center rounded-full bg-primary text-bg text-[1.5vw] font-extrabold tabular-nums">4</div>
              <div className="text-[1.5vw] font-semibold text-ink">Loan unlocks</div>
            </div>
          </div>
          <div className="text-[1.5vw] font-light text-text/55 leading-snug">
            Every state change is timestamped and stored in the loan&#8217;s audit log.
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Guarantors</span>
        <span>Faster, cleaner approvals</span>
      </div>
    </div>
  );
}
