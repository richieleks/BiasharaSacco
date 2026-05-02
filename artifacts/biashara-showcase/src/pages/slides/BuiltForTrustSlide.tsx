export default function BuiltForTrustSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-ink font-display text-bg">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(38,112,217,0.35),transparent_55%)]" />

      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-bg/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-bg/40 tabular-nums">
          14 / 15
        </span>
      </div>

      <div className="absolute top-[14vh] left-[6vw] right-[40vw]">
        <div className="flex items-center gap-[1vw]">
          <span className="block h-[0.5vh] w-[5vw] bg-accent" />
          <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">
            Built for trust
          </span>
        </div>
        <h1 className="mt-[3vh] text-[6.8vw] font-extrabold leading-[0.92] tracking-tight text-bg text-balance">
          Members trust the
          <span className="block text-accent">SACCO. The SACCO</span>
          <span className="block">trusts the system.</span>
        </h1>
      </div>

      <div className="absolute right-[6vw] top-[16vh] bottom-[12vh] w-[30vw] flex flex-col justify-between gap-[1.6vh]">
        <div className="rounded-[1.2vh] border border-bg/15 bg-bg/[0.04] p-[2.2vh]">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">Audit logs</div>
          <div className="mt-[1vh] text-[1.7vw] font-extrabold leading-tight text-bg">Every change, on the record.</div>
          <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-bg/70">Actor, timestamp and before/after value for every sensitive action.</div>
        </div>
        <div className="rounded-[1.2vh] border border-bg/15 bg-bg/[0.04] p-[2.2vh]">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">Role enforcement</div>
          <div className="mt-[1vh] text-[1.7vw] font-extrabold leading-tight text-bg">Permissions checked everywhere.</div>
          <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-bg/70">Both the API and the screen ask the same question before showing data.</div>
        </div>
        <div className="rounded-[1.2vh] border border-bg/15 bg-bg/[0.04] p-[2.2vh]">
          <div className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-accent">Automated backups</div>
          <div className="mt-[1vh] text-[1.7vw] font-extrabold leading-tight text-bg">Daily snapshots, kept safe.</div>
          <div className="mt-[0.6vh] text-[1.5vw] font-light leading-snug text-bg/70">Recover from a mistake without losing the day&#8217;s work.</div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-center justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-bg/40">
        <span>Trust</span>
        <span>The quiet foundation</span>
      </div>
    </div>
  );
}
