const base = import.meta.env.BASE_URL;

export default function ClosingSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg font-display text-text">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(38,112,217,0.08)_0%,rgba(46,183,138,0.06)_100%)]" />

      <div className="absolute top-0 left-0 right-0 h-[8vh] flex items-center justify-between px-[6vw]">
        <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-text/70">
          Biashara SACCO
        </span>
        <span className="text-[1.5vw] font-light tracking-[0.3em] text-text/40 tabular-nums">
          15 / 15
        </span>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[20vh] flex items-center gap-[2vw]">
        <img
          src={`${base}biashara-logo.png`}
          crossOrigin="anonymous"
          alt="Biashara SACCO logo"
          className="h-[14vh] w-[14vh] object-contain"
        />
        <div>
          <div className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-primary">Biashara SACCO</div>
          <div className="text-[2.6vw] font-light tracking-tight text-text/70">Management system</div>
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] top-[44vh]">
        <h1 className="text-[7.2vw] font-extrabold leading-[0.92] tracking-tight text-ink text-balance">
          Ready to see Biashara
          <span className="block text-primary">in your SACCO?</span>
        </h1>
      </div>

      <div className="absolute left-[6vw] right-[6vw] bottom-[14vh] flex items-end justify-between gap-[3vw]">
        <p className="max-w-[55vw] text-[1.6vw] font-light leading-snug text-text/70 text-pretty">
          Members, savings, loans, guarantors, transactions, share capital,
          reports, imports and access — all in one trusted workspace.
        </p>
        <div className="flex flex-col items-end gap-[0.6vh]">
          <span className="text-[1.5vw] font-semibold tracking-[0.3em] uppercase text-text/50">End</span>
          <span className="text-[1.5vw] font-light text-text/70">Thank you</span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[1.2vh] bg-[linear-gradient(to_right,var(--slide-primary),var(--slide-accent),var(--slide-warning))]" />
    </div>
  );
}
