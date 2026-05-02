export default function RolesAccessSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          13 / 15
        </span>
      </div>

      <div className="absolute top-[12vh] left-[6vw] right-[6vw] flex items-end justify-between">
        <div>
          <div className="flex items-center gap-[1vw]">
            <span className="block h-[0.5vh] w-[5vw] bg-primary" />
            <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-primary">
              Module 10 · Roles &amp; Access
            </span>
          </div>
          <h1 className="mt-[2vh] text-[5.4vw] font-extrabold leading-[0.95] tracking-tight text-ink text-balance">
            The right people see
            <span className="block text-primary">the right things.</span>
          </h1>
        </div>
        <div className="flex h-[14vh] w-[14vh] items-center justify-center rounded-[1.6vh] bg-primary/10">
          <svg viewBox="0 0 24 24" className="h-[8vh] w-[8vh]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--slide-primary)' }}>
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
            <path d="M12 8v4M12 15h.01" />
          </svg>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[52vh] bottom-[12vh] grid grid-cols-12 gap-[2vw]">
        <div className="col-span-7 flex flex-col gap-[2.4vh]">
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Per-action permissions</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Read, create, update, delete, execute — defined per resource.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Custom roles</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Build a &#8220;branch officer&#8221; or &#8220;loan auditor&#8221; without code.</div>
            </div>
          </div>
          <div className="flex items-start gap-[1.4vw]">
            <span className="mt-[0.8vh] block h-[1.6vh] w-[1.6vh] rounded-full bg-primary shrink-0" />
            <div>
              <div className="text-[1.7vw] font-semibold leading-tight text-ink">Visual role-permission matrix</div>
              <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-text/70">Tick the boxes; the system enforces them everywhere.</div>
            </div>
          </div>
        </div>

        <div className="col-span-5 rounded-[1.4vh] bg-surface border border-text/5 p-[2vh]">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-text/55 mb-[1.2vh]">
            Sample matrix
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[1.5vw] font-semibold tracking-[0.05em] uppercase text-text/55 pb-[0.8vh] border-b border-text/10">
            <div>Resource</div>
            <div className="text-center">Admin</div>
            <div className="text-center">Treas.</div>
            <div className="text-center">Member</div>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[1.5vw] py-[0.8vh] border-b border-text/5 items-center">
            <div className="font-semibold text-ink">Members</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-text/30">—</div>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[1.5vw] py-[0.8vh] border-b border-text/5 items-center">
            <div className="font-semibold text-ink">Approve loan</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-text/30">—</div>
            <div className="text-center text-text/30">—</div>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[1.5vw] py-[0.8vh] border-b border-text/5 items-center">
            <div className="font-semibold text-ink">Import savings</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-text/30">—</div>
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[1.5vw] py-[0.8vh] items-center">
            <div className="font-semibold text-ink">Own statement</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-accent font-extrabold">✓</div>
            <div className="text-center text-accent font-extrabold">✓</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-text/40">
        <span>Roles &amp; Access</span>
        <span>Fine-grained, by design</span>
      </div>
    </div>
  );
}
