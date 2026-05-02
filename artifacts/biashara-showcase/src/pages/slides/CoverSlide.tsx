const base = import.meta.env.BASE_URL;

export default function CoverSlide() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-ink font-display text-bg">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(38,112,217,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(46,183,138,0.25),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,10,20,0)_0%,rgba(6,10,20,0.4)_60%,rgba(6,10,20,0.85)_100%)]" />

      <div className="absolute top-[6vh] left-[6vw] right-[6vw] flex items-center justify-between">
        <div className="flex items-center gap-[1.2vw]">
          <img
            src={`${base}biashara-logo.png`}
            crossOrigin="anonymous"
            alt="Biashara SACCO logo"
            className="h-[5vh] w-[5vh] object-contain"
          />
          <span className="text-[1.5vw] font-semibold tracking-[0.32em] uppercase text-bg/80">
            Biashara SACCO
          </span>
        </div>
        <div className="text-[1.5vw] font-light tracking-[0.3em] uppercase text-bg/60">
          Product Showcase
        </div>
      </div>

      <div className="absolute left-[6vw] right-[6vw] bottom-[14vh]">
        <div className="text-[1.5vw] font-semibold tracking-[0.4em] uppercase text-accent">
          The complete SACCO platform
        </div>
        <h1 className="mt-[3vh] text-[8.4vw] font-extrabold leading-[0.92] tracking-tight text-bg text-balance">
          Run the whole
          <span className="block text-primary">co&#8209;operative</span>
          <span className="block">in one place.</span>
        </h1>
        <p className="mt-[4vh] max-w-[55vw] text-[1.7vw] font-light leading-snug text-bg/70 text-pretty">
          Members, savings, loans, guarantors, transactions, share capital, reports
          and access control — every module, one system, built for SACCOs.
        </p>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex items-end justify-between text-[1.5vw] font-light tracking-[0.3em] uppercase text-bg/50">
        <span>Savings · Credit · Reports</span>
        <span>01 / 15</span>
      </div>
    </div>
  );
}
