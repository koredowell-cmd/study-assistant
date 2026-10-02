const SYMBOLS = [
  { t: "∑", l: "6%", s: 46, d: 26, delay: -4, dx: 30, r: 25, c: "rgba(255,255,255,0.35)" },
  { t: "π", l: "16%", s: 34, d: 32, delay: -18, dx: -25, r: -30, c: "rgba(245,183,0,0.45)" },
  { t: "?", l: "27%", s: 56, d: 28, delay: -10, dx: 20, r: 18, c: "rgba(255,255,255,0.3)" },
  { t: "✓", l: "38%", s: 38, d: 34, delay: -22, dx: -30, r: -20, c: "rgba(25,195,125,0.55)" },
  { t: "A+", l: "49%", s: 42, d: 30, delay: -7, dx: 28, r: 22, c: "rgba(245,183,0,0.45)" },
  { t: "√x", l: "58%", s: 36, d: 36, delay: -26, dx: -20, r: -25, c: "rgba(255,255,255,0.3)" },
  { t: "∫", l: "68%", s: 58, d: 27, delay: -14, dx: 24, r: 28, c: "rgba(255,255,255,0.3)" },
  { t: "%", l: "78%", s: 36, d: 33, delay: -3, dx: -28, r: -18, c: "rgba(25,195,125,0.5)" },
  { t: "Δ", l: "87%", s: 44, d: 29, delay: -20, dx: 22, r: 20, c: "rgba(245,183,0,0.4)" },
  { t: "E=mc²", l: "92%", s: 24, d: 38, delay: -12, dx: -24, r: -22, c: "rgba(255,255,255,0.28)" },
  { t: "?", l: "11%", s: 30, d: 40, delay: -30, dx: 18, r: 15, c: "rgba(255,255,255,0.25)" },
  { t: "✓", l: "73%", s: 28, d: 42, delay: -34, dx: -16, r: -12, c: "rgba(255,255,255,0.25)" },
];

export default function Backdrop() {
  return (
    <div aria-hidden="true" className="backdrop">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="dots" />
      {SYMBOLS.map((s, i) => (
        <span
          key={i}
          className="sym"
          style={
            {
              left: s.l,
              fontSize: s.s,
              color: s.c,
              animationDuration: `${s.d}s`,
              animationDelay: `${s.delay}s`,
              "--dx": `${s.dx}px`,
              "--rot": `${s.r}deg`,
            } as React.CSSProperties
          }
        >
          {s.t}
        </span>
      ))}
    </div>
  );
}