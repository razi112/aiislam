export default function TypingIndicator() {
  return (
    <div className="flex items-start px-4 py-3 max-w-3xl mx-auto w-full">
      <style>{`
        @keyframes ti-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Outer ring slow rotation */
        @keyframes ti-ring-spin {
          to { transform: rotate(360deg); }
        }

        /* Inner dot breathe */
        @keyframes ti-core-pulse {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50%       { transform: scale(1.15); opacity: 1; }
        }

        /* Arc dash — sweeping highlight */
        @keyframes ti-arc-sweep {
          0%   { stroke-dashoffset: 88; opacity: 0.25; }
          40%  { stroke-dashoffset: 0;  opacity: 1; }
          100% { stroke-dashoffset: -88; opacity: 0.25; }
        }

        /* Bar wave */
        @keyframes ti-bar {
          0%, 100% { transform: scaleY(0.3); opacity: 0.35; }
          50%       { transform: scaleY(1);   opacity: 1; }
        }

        /* Label shimmer */
        @keyframes ti-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }

        .ti-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          animation: ti-fade-up 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }

        /* ── Orbital spinner ── */
        .ti-orbit {
          position: relative;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
        }
        .ti-orbit svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .ti-ring {
          animation: ti-ring-spin 2.4s linear infinite;
          transform-origin: 17px 17px;
        }
        .ti-arc {
          animation: ti-arc-sweep 1.6s ease-in-out infinite;
        }
        .ti-core {
          animation: ti-core-pulse 1.6s ease-in-out infinite;
          transform-origin: 17px 17px;
        }

        /* ── Waveform bars ── */
        .ti-bars {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 20px;
        }
        .ti-bar {
          width: 3px;
          height: 100%;
          border-radius: 99px;
          background: var(--accent);
          transform-origin: center bottom;
          animation: ti-bar 1s ease-in-out infinite;
        }
        .ti-bar:nth-child(1) { animation-delay: 0s;    height: 60%; }
        .ti-bar:nth-child(2) { animation-delay: 0.1s;  height: 100%; }
        .ti-bar:nth-child(3) { animation-delay: 0.2s;  height: 75%; }
        .ti-bar:nth-child(4) { animation-delay: 0.3s;  height: 100%; }
        .ti-bar:nth-child(5) { animation-delay: 0.15s; height: 55%; }

        /* ── Label ── */
        .ti-label {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.01em;
          background: linear-gradient(
            90deg,
            var(--text-muted) 0%,
            var(--accent) 40%,
            var(--text-muted) 60%,
            var(--text-muted) 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ti-shimmer 2.4s linear infinite;
        }
      `}</style>

      <div className="ti-wrap">

        {/* Orbital spinner */}
        <div className="ti-orbit">
          {/* Static background circle */}
          <svg viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="14"
              stroke="var(--accent-border)"
              strokeWidth="1.5"
              fill="var(--accent-subtle)"
            />
          </svg>

          {/* Spinning ring with sweeping arc */}
          <svg viewBox="0 0 34 34" fill="none" className="ti-ring">
            <circle cx="17" cy="17" r="14"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="22 66"
              opacity="0.5"
              className="ti-arc"
            />
          </svg>

          {/* Center dot */}
          <svg viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="4.5"
              fill="var(--accent)"
              className="ti-core"
            />
          </svg>
        </div>

        {/* Waveform */}
        <div className="ti-bars">
          <div className="ti-bar" />
          <div className="ti-bar" />
          <div className="ti-bar" />
          <div className="ti-bar" />
          <div className="ti-bar" />
        </div>

        {/* Shimmer label */}
        <span className="ti-label">Thinking…</span>

      </div>
    </div>
  )
}
