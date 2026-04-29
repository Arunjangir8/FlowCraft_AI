// ── Drawing Loader ──
export function DrawingLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      {/* Animated canvas being drawn */}
      <div className="relative w-24 h-24">
        <svg
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Border trace animation — draws the square border */}
          <rect
            x="4" y="4" width="88" height="88"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="352"
            strokeDashoffset="352"
            strokeLinecap="square"
            style={{
              animation: "draw-border 1.8s ease-in-out infinite",
            }}
          />

          {/* Pencil icon in the center */}
          <g style={{ animation: "pencil-bob 1.8s ease-in-out infinite" }}>
            <line x1="38" y1="58" x2="54" y2="42" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <line x1="54" y1="42" x2="58" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <line x1="38" y1="58" x2="34" y2="62" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <polyline points="38,58 54,42 58,38 62,42 46,58 38,58" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round"/>
            <line x1="54" y1="42" x2="58" y2="46" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </g>
        </svg>
      </div>

      <p className="text-gray-500 text-xs uppercase tracking-[0.25em] animate-pulse">
        Loading drawings...
      </p>

      <style>{`
        @keyframes draw-border {
          0%   { stroke-dashoffset: 352; opacity: 1; }
          70%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0.3; }
          100% { stroke-dashoffset: 352; opacity: 0.3; }
        }
        @keyframes pencil-bob {
          0%,100% { transform: translate(0, 0); }
          50%     { transform: translate(-3px, 3px); }
        }
      `}</style>
    </div>
  );
}