export default function DataImportSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          12 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-warning" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-warning">
              Module 09 · Data Import
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            Bring your records in,
            <span className="block text-warning">one type at a time.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-warning/15">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-warning)' }}>
            <path d="M12 3v12" />
            <path d="M7 8l5-5 5 5" />
            <path d="M4 17v2c0 1 1 2 2 2h12c1 0 2-1 2-2v-2" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[15vh]">
        <div className="grid grid-cols-5 gap-[1.4vw]">
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
            <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-warning">Type 01</div>
            <div>
              <div className="text-[1.6vw] font-extrabold leading-tight text-ink">Members</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Bulk member onboarding from CSV.</div>
            </div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
            <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-accent">Type 02</div>
            <div>
              <div className="text-[1.6vw] font-extrabold leading-tight text-ink">Savings</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Account openings and balances.</div>
            </div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
            <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-primary">Type 03</div>
            <div>
              <div className="text-[1.6vw] font-extrabold leading-tight text-ink">Loans</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Loan books with active balances.</div>
            </div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
            <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-primary">Type 04</div>
            <div>
              <div className="text-[1.6vw] font-extrabold leading-tight text-ink">Loan repayments</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Bulk CSV repayment posting.</div>
            </div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-between">
            <div className="text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-accent">Type 05</div>
            <div>
              <div className="text-[1.6vw] font-extrabold leading-tight text-ink">Bulk savings</div>
              <div className="mt-[0.4vh] text-[1.5vw] font-light leading-snug text-text/65">Mass deposit posting from payroll.</div>
            </div>
          </div>
        </div>
        <div className="mt-[3vh] rounded-[1vh] border border-warning/25 bg-warning/5 p-[2vh] flex items-center justify-between">
          <div>
            <div className="text-[1.5vw] font-extrabold text-ink">Each import is its own permission.</div>
            <div className="mt-[0.4vh] text-[1.5vw] font-light text-text/70 leading-snug">Grant a clerk &#8220;import savings&#8221; without giving them loans.</div>
          </div>
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-warning">Granular RBAC</div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Data Import</span>
        <span>Five independent permissions</span>
      </div>
    </div>
  );
}
