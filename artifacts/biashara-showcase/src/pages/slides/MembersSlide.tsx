export default function MembersSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          05 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module 02 · Members
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.6vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            The member, never
            <span className="block text-primary">a row in a spreadsheet.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
            <circle cx="17" cy="6" r="2.5" />
            <path d="M22 18c0-2.5-2-4.5-5-4.5" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[12vh] grid grid-cols-12 gap-[2vw]">
        <div className="col-span-7 flex flex-col gap-[2.4vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Onboarding &amp; profiles</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">National ID, contact, department, employer — captured once, used everywhere.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-accent shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Lifecycle status</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Pending, active, inactive, dormant — every state visible and filterable.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-warning shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Single member view</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Savings balances, active loans, guarantor links and history in one record.</div>
            </div>
          </div>
        </div>

        <div className="col-span-5 grid grid-cols-2 gap-[1.2vw]">
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-end">
            <div className="text-[2.6vw] font-extrabold text-primary leading-none">Active</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60">trading members</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-end">
            <div className="text-[2.6vw] font-extrabold text-warning leading-none">Pending</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60">awaiting approval</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-end">
            <div className="text-[2.6vw] font-extrabold text-text/55 leading-none">Inactive</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60">no recent activity</div>
          </div>
          <div className="rounded-[1vh] bg-surface border border-text/5 p-[1.8vh] flex flex-col justify-end">
            <div className="text-[2.6vw] font-extrabold text-danger leading-none">Dormant</div>
            <div className="mt-[0.6vh] text-[1.5vw] font-light text-text/60">flagged for review</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Members</span>
        <span>Know who you serve</span>
      </div>
    </div>
  );
}
