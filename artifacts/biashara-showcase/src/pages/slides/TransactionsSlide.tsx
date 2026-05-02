export default function TransactionsSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          09 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-accent" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">
              Module 06 · Transactions
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.6vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            One ledger.
            <span className="block text-accent">Every movement.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-accent/15">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-accent)' }}>
            <path d="M3 7l4-4 4 4" />
            <path d="M7 3v12" />
            <path d="M21 17l-4 4-4-4" />
            <path d="M17 21V9" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[50vh] bottom-[10vh] grid grid-cols-12 gap-[2vw]">
        <div className="col-span-6 flex flex-col gap-[2.2vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Unified financial ledger</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Deposits, withdrawals and repayments in one feed.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Audit trail by default</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Actor, timestamp and source on every entry.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Filter, find, reconcile</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">By member, by date, by type.</div>
            </div>
          </div>
        </div>

        <div className="col-span-6 rounded-[1.4vh] bg-surface border border-text/5 p-[2vh] flex flex-col gap-[1vh]">
          <div className="flex items-center justify-between text-[1.5vw] font-semibold tracking-[0.25em] uppercase text-text/55">
            <span>Live ledger</span>
            <span>Today</span>
          </div>
          <div className="flex items-center justify-between border-b border-text/5 pb-[0.8vh]">
            <div>
              <div className="text-[1.5vw] font-semibold text-ink leading-tight">Deposit · J. Wanjiru</div>
              <div className="text-[1.5vw] font-light text-text/55 leading-tight">Regular savings · 10:14</div>
            </div>
            <div className="text-[1.8vw] font-extrabold text-accent tabular-nums">+12,000</div>
          </div>
          <div className="flex items-center justify-between border-b border-text/5 pb-[0.8vh]">
            <div>
              <div className="text-[1.5vw] font-semibold text-ink leading-tight">Repayment · M. Otieno</div>
              <div className="text-[1.5vw] font-light text-text/55 leading-tight">Loan #1142 · 09:48</div>
            </div>
            <div className="text-[1.8vw] font-extrabold text-primary tabular-nums">+8,500</div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[1.5vw] font-semibold text-ink leading-tight">Disbursement · F. Njoroge</div>
              <div className="text-[1.5vw] font-light text-text/55 leading-tight">Loan #1148 · 08:30</div>
            </div>
            <div className="text-[1.8vw] font-extrabold text-warning tabular-nums">+50,000</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Transactions</span>
        <span>The single source of truth</span>
      </div>
    </div>
  );
}
