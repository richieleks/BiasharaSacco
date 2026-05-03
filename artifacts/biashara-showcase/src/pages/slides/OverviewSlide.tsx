export default function OverviewSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          02 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] flex items-center gap-[1vw]">
        <span className="block h-[0.5vh] w-[5vw] bg-primary" />
        <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
          What is Biashara
        </span>
      </div>

      <h1 className="absolute top-[18vh] left-[6vw] right-[40vw] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
        A SACCO management system
        <span className="block text-primary">designed for daily operations.</span>
      </h1>

      <p className="absolute top-[55vh] left-[6vw] right-[40vw] text-[1.7vw] font-light leading-snug text-text/75 text-pretty">
        Biashara replaces the patchwork of spreadsheets, paper files and stand-alone
        apps that most SACCOs juggle. Every member, every shilling and every
        decision lives in a single, role-aware system.
      </p>

      <div className="absolute right-[6vw] top-[18vh] bottom-[10vh] w-[28vw] flex flex-col justify-between gap-[1.6vh]">
        <div className="rounded-[1.2vh] bg-surface p-[1.8vh] border border-text/5">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">Members</div>
          <div className="mt-[0.6vh] text-[3vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
            371
          </div>
          <div className="mt-[0.8vh] text-[1.5vw] font-light leading-snug text-text/70">
            live in the Biashara workspace
          </div>
        </div>
        <div className="rounded-[1.2vh] bg-surface p-[1.8vh] border border-text/5">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">Savings</div>
          <div className="mt-[0.6vh] text-[3vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
            UGX 899M
          </div>
          <div className="mt-[0.8vh] text-[1.5vw] font-light leading-snug text-text/70">
            on the books across member accounts
          </div>
        </div>
        <div className="rounded-[1.2vh] bg-surface p-[1.8vh] border border-text/5">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-warning">Ledger</div>
          <div className="mt-[0.6vh] text-[3vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
            27
          </div>
          <div className="mt-[0.8vh] text-[1.5vw] font-light leading-snug text-text/70">
            chart-of-accounts entries, double-entry
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Overview · Live Biashara SACCO tenant</span>
        <span>One platform. Ten modules.</span>
      </div>
    </div>
  );
}
