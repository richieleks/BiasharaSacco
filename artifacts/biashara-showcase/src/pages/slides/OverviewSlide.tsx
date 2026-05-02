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
            500+
          </div>
          <div className="mt-[0.8vh] text-[1.5vw] font-light leading-snug text-text/70">
            registrations in one workspace
          </div>
        </div>
        <div className="rounded-[1.2vh] bg-surface p-[1.8vh] border border-text/5">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">Loans</div>
          <div className="mt-[0.6vh] text-[3vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
            End&#8209;to&#8209;end
          </div>
          <div className="mt-[0.8vh] text-[1.5vw] font-light leading-snug text-text/70">
            application to final repayment
          </div>
        </div>
        <div className="rounded-[1.2vh] bg-surface p-[1.8vh] border border-text/5">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-warning">Reports</div>
          <div className="mt-[0.6vh] text-[3vw] font-extrabold leading-none tracking-tight text-ink tabular-nums">
            Real&#8209;time
          </div>
          <div className="mt-[0.8vh] text-[1.5vw] font-light leading-snug text-text/70">
            statements and audit trails
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Overview</span>
        <span>One platform. Ten modules.</span>
      </div>
    </div>
  );
}
