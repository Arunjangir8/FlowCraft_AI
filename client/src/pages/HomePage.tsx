import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Types ──────────────────────────────────────────────
type Node = {
  x: number; y: number; w: number; h: number;
  label: string; delay: number; accent?: boolean;
};
type Edge = { x1: number; y1: number; x2: number; y2: number; delay: number };

// ── Animated Flow SVG ──────────────────────────────────
function FlowSVG({ id, nodes, edges }: { id: string; nodes: Node[]; edges: Edge[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const animate = () => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.innerHTML = `
      <defs>
        <marker id="ah-${id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a"/>
        </marker>
      </defs>
    `;

    edges.forEach((e) => {
      const t = setTimeout(() => {
        if (!svgRef.current) return;
        const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
        const ns = "http://www.w3.org/2000/svg";
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", String(e.x1));
        line.setAttribute("y1", String(e.y1));
        line.setAttribute("x2", String(e.x2));
        line.setAttribute("y2", String(e.y2));
        line.setAttribute("stroke", "#2a2a2a");
        line.setAttribute("stroke-width", "1.5");
        line.setAttribute("marker-end", `url(#ah-${id})`);
        line.setAttribute("stroke-dasharray", String(len));
        line.setAttribute("stroke-dashoffset", String(len));
        line.style.transition = "stroke-dashoffset 0.5s ease";
        svgRef.current.appendChild(line);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => line.setAttribute("stroke-dashoffset", "0"))
        );
      }, e.delay);
      timers.current.push(t);
    });

    nodes.forEach((n) => {
      const t = setTimeout(() => {
        if (!svgRef.current) return;
        const ns = "http://www.w3.org/2000/svg";
        const g = document.createElementNS(ns, "g");
        g.style.opacity = "0";
        g.style.transition = "opacity 0.3s ease";
        const rect = document.createElementNS(ns, "rect");
        rect.setAttribute("x", String(n.x - n.w / 2));
        rect.setAttribute("y", String(n.y - n.h / 2));
        rect.setAttribute("width", String(n.w));
        rect.setAttribute("height", String(n.h));
        rect.setAttribute("fill", n.accent ? "#e8c547" : "#111");
        rect.setAttribute("stroke", n.accent ? "#e8c547" : "#2a2a2a");
        rect.setAttribute("stroke-width", "1");
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", String(n.x));
        text.setAttribute("y", String(n.y + 1));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("fill", n.accent ? "#080808" : "#888");
        text.setAttribute("font-size", "9");
        text.setAttribute("font-family", "JetBrains Mono, monospace");
        text.setAttribute("letter-spacing", "0.05em");
        text.textContent = n.label;
        g.appendChild(rect);
        g.appendChild(text);
        svgRef.current.appendChild(g);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => (g.style.opacity = "1"))
        );
      }, n.delay);
      timers.current.push(t);
    });

    const total = Math.max(...nodes.map((n) => n.delay), ...edges.map((e) => e.delay)) + 800;
    const loop = setTimeout(() => animate(), total + 1200);
    timers.current.push(loop);
  };

  useEffect(() => {
    animate();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  return <svg ref={svgRef} id={id} className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" />;
}

// ── Typewriter ─────────────────────────────────────────
function TypedPrompt() {
  const prompts = [
    "A user login flow with OAuth...",
    "E-commerce checkout process...",
    "CI/CD pipeline from push to deploy...",
    "Support ticket escalation flow...",
  ];
  const [display, setDisplay] = useState("");
  const [pi, setPi] = useState(0);
  const [ci, setCi] = useState(0);
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const prompt = prompts[pi];
    let timeout: ReturnType<typeof setTimeout>;

    if (typing) {
      if (ci < prompt.length) {
        timeout = setTimeout(() => setCi((c) => c + 1), 50 + Math.random() * 30);
      } else {
        timeout = setTimeout(() => setTyping(false), 2200);
      }
    } else {
      if (ci > 0) {
        timeout = setTimeout(() => setCi((c) => c - 1), 18);
      } else {
        setTyping(true);
        setPi((p) => (p + 1) % prompts.length);
      }
    }

    setDisplay(prompt.slice(0, ci));
    return () => clearTimeout(timeout);
  }, [ci, typing, pi]);

  return (
    <div className="bg-[#111] border border-[#222] px-5 py-4 font-mono text-[13px] text-[#ccc] leading-relaxed min-h-[80px]">
      {display}
      <span className="inline-block w-[2px] h-[14px] bg-[#e8c547] ml-[2px] align-middle animate-[blink_1s_infinite]" />
    </div>
  );
}

// ── Main Landing Page ──────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();

  // Hero nodes/edges
  const heroNodes: Node[] = [
  { x: 230, y: 44,  w: 120, h: 32, label: "User Request",   delay: 0 },
  { x: 230, y: 120, w: 120, h: 32, label: "AI Processor",   delay: 300, accent: true },
  { x: 80,  y: 210, w: 100, h: 32, label: "Parse Intent",   delay: 600 },
  { x: 230, y: 210, w: 100, h: 32, label: "Generate",       delay: 700 },
  { x: 380, y: 210, w: 100, h: 32, label: "Validate",       delay: 800 },
  { x: 230, y: 284, w: 120, h: 32, label: "Output Diagram", delay: 1100 },
];
  const heroEdges: Edge[] = [
  { x1: 230, y1: 60,  x2: 230, y2: 104, delay: 150 },
  { x1: 200, y1: 136, x2: 80,  y2: 194, delay: 450 },
  { x1: 230, y1: 136, x2: 230, y2: 194, delay: 550 },
  { x1: 260, y1: 136, x2: 380, y2: 194, delay: 650 },
  { x1: 80,  y1: 226, x2: 195, y2: 268, delay: 900 },
  { x1: 230, y1: 226, x2: 230, y2: 268, delay: 1000 },
  { x1: 380, y1: 226, x2: 265, y2: 268, delay: 1050 },
];


  // Demo nodes/edges
  const demoNodes: Node[] = [
    { x: 180, y: 24,  w: 80, h: 26, label: "Start",       delay: 200, accent: true },
    { x: 90,  y: 90,  w: 80, h: 26, label: "Auth Check",  delay: 400 },
    { x: 270, y: 90,  w: 80, h: 26, label: "Load Data",   delay: 500 },
    { x: 90,  y: 160, w: 80, h: 26, label: "Error State", delay: 700 },
    { x: 270, y: 160, w: 80, h: 26, label: "Dashboard",   delay: 800 },
    { x: 180, y: 216, w: 80, h: 26, label: "End",         delay: 1000 },
  ];
  const demoEdges: Edge[] = [
    { x1: 180, y1: 37,  x2: 90,  y2: 90,  delay: 300 },
    { x1: 180, y1: 37,  x2: 270, y2: 90,  delay: 350 },
    { x1: 90,  y1: 103, x2: 90,  y2: 160, delay: 600 },
    { x1: 270, y1: 103, x2: 270, y2: 160, delay: 650 },
    { x1: 90,  y1: 173, x2: 180, y2: 216, delay: 850 },
    { x1: 270, y1: 173, x2: 180, y2: 216, delay: 900 },
  ];

  const features = [
    {
      num: "01", title: "AI Generation",
      desc: "Type a description and watch FlowCraft build your entire diagram — nodes, connections, and labels — in under 3 seconds.",
    },
    {
      num: "02", title: "Manual Drawing",
      desc: "Full drag-and-drop canvas. Add nodes, connect them, resize, label, and organise with pixel-level precision.",
    },
    {
      num: "03", title: "Smart Layouts",
      desc: "Auto-arrange your diagram into clean hierarchies. FlowCraft detects flow direction and spaces everything perfectly.",
    },
    {
      num: "04", title: "Saved Projects",
      desc: "All your diagrams are auto-saved and organised in your personal dashboard. Rename, delete, or open instantly.",
    },
    {
      num: "05", title: "Iterative Editing",
      desc: "Ask the AI to revise, extend, or simplify any part of your diagram using natural language follow-ups.",
    },
    {
      num: "06", title: "Multiple Diagrams",
      desc: "Flowcharts, system maps, process diagrams, org charts. One tool handles every kind of visual structure.",
    },
  ];

  const marqueeItems = [
    "AI Flow Generation", "Manual Drawing", "Smart Layouts",
    "Instant Diagrams", "Editable Canvas", "No-Code Diagramming",
    "Process Maps", "System Design",
  ];

  return (
    <div className="bg-[#080808] text-[#f5f0e8] font-sans overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;600&family=Instrument+Sans:wght@400;500;600&display=swap');
        .font-serif-display { font-family: 'DM Serif Display', serif; }
        .font-mono-jet { font-family: 'JetBrains Mono', monospace; }
        .font-instrument { font-family: 'Instrument Sans', sans-serif; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .animate-marquee { animation: marquee 25s linear infinite; }
        .animate-fade-up-1 { animation: fadeUp 0.6s ease 0.2s both; }
        .animate-fade-up-2 { animation: fadeUp 0.7s ease 0.35s both; }
        .animate-fade-up-3 { animation: fadeUp 0.7s ease 0.5s both; }
        .animate-fade-up-4 { animation: fadeUp 0.7s ease 0.65s both; }
        .dot-grid { background-image: radial-gradient(circle, #2a2a2a 1px, transparent 1px); background-size: 28px 28px; }
        .cta-glow { background: radial-gradient(ellipse 60% 60% at 50% 50%, #1a1600 0%, transparent 70%); }
      `}</style>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#1e1e1e] bg-[rgba(8,8,8,0.92)] backdrop-blur-md">
        <span className="font-mono-jet text-[15px] font-semibold tracking-wide">
          flow<span className="text-[#e8c547]">craft</span>
        </span>
        <div className="hidden md:flex items-center gap-8">
          {["Features", "How it works", "Demo"].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
              className="text-[13px] text-[#666] hover:text-[#f5f0e8] transition-colors">
              {l}
            </a>
          ))}
        </div>
        <button
          onClick={() => navigate("/login")}
          className="font-mono-jet text-[12px] font-semibold bg-[#f5f0e8] text-[#080808] px-5 py-2.5 hover:bg-[#e8c547] transition-colors tracking-wide"
        >
          Start for free →
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center pt-20 px-6 md:px-12 overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-60 pointer-events-none" />
        <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left */}
          <div>
            <p className="animate-fade-up-1 font-mono-jet text-[11px] tracking-[0.15em] text-[#e8c547] uppercase mb-6">
              AI-Powered Diagramming
            </p>
            <h1 className="animate-fade-up-2 font-serif-display text-5xl md:text-6xl xl:text-7xl leading-[1.05] mb-7">
              Draw ideas.<br />
              <em className="italic text-[#e8c547]">Think faster.</em>
            </h1>
            <p className="animate-fade-up-3 text-[16px] leading-[1.7] text-[#999] max-w-md mb-10">
              Describe your flow in plain language — FlowCraft turns it into clean, editable diagrams instantly. Or draw manually, your canvas, your rules.
            </p>
            <div className="animate-fade-up-4 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => navigate("/login")}
                className="font-mono-jet text-[13px] font-semibold bg-[#f5f0e8] text-[#080808] px-7 py-3.5 hover:bg-[#e8c547] transition-colors tracking-wide"
              >
                Start drawing free
              </button>
              <a href="#demo"
                className="font-mono-jet text-[12px] text-[#666] hover:text-[#f5f0e8] border-b border-[#333] hover:border-[#f5f0e8] pb-0.5 transition-all tracking-wide">
                See how it works
              </a>
            </div>
            <p className="font-mono-jet text-[10px] text-[#444] mt-6 tracking-[0.08em]">
              No credit card · <span className="text-[#e8c547]">AI-generated</span> in seconds · Fully editable
            </p>
          </div>

          {/* Right — Canvas */}
          <div className="hidden lg:block">
            <div className="border border-[#2a2a2a] bg-[#0d0d0d] p-3">
              <div className="flex gap-1.5 mb-3 pb-3 border-b border-[#1e1e1e]">
                <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              </div>
              <div className="relative h-[350px]">
                <FlowSVG id="hero-svg" nodes={heroNodes} edges={heroEdges} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="border-t border-b border-[#1a1a1a] py-4 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-flex">
          {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, i) => (
            <span key={i} className="font-mono-jet text-[12px] text-[#333] uppercase tracking-[0.1em] px-12">
              {item}<span className="text-[#e8c547] ml-12">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end mb-16">
            <div>
              <p className="font-mono-jet text-[11px] tracking-[0.15em] text-[#e8c547] uppercase mb-5">What you get</p>
              <h2 className="font-serif-display text-4xl md:text-5xl leading-[1.1]">Everything your ideas need</h2>
            </div>
            <p className="text-[16px] text-[#888] leading-[1.7] max-w-md">
              From a quick process map to a complex system architecture — built for how you actually think.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-[#1a1a1a] border border-[#1a1a1a]">
            {features.map((f) => (
              <div key={f.num} className="bg-[#080808] hover:bg-[#0f0f0f] transition-colors p-8 md:p-10">
                <p className="font-mono-jet text-[11px] text-[#2a2a2a] tracking-widest mb-8">{f.num}</p>
                <h3 className="font-serif-display text-[22px] mb-3 leading-snug">{f.title}</h3>
                <p className="text-[14px] text-[#666] leading-[1.75]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 border-t border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono-jet text-[11px] tracking-[0.15em] text-[#e8c547] uppercase mb-5">The process</p>
          <h2 className="font-serif-display text-4xl md:text-5xl leading-[1.1] mb-16">Three steps to clarity</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative">
            {/* connector line — desktop only */}
            <div className="hidden md:block absolute top-7 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent" />
            {[
              { num: "01", title: "Describe your idea", desc: 'Type what you want in plain English. "A login flow with OAuth and error states" is enough to get started.', tag: "→ Natural language input", accent: true },
              { num: "02", title: "AI builds the diagram", desc: "FlowCraft interprets your prompt, creates nodes, draws connections, and labels everything in seconds.", tag: "→ Generated in <3s", accent: false },
              { num: "03", title: "Edit & perfect it", desc: "Drag nodes, reroute connections, rename labels — or just ask the AI to change it. Your diagram, your way.", tag: "→ Fully editable canvas", accent: false },
            ].map((s) => (
              <div key={s.num} className="relative z-10 px-0 md:px-8 mb-12 md:mb-0">
                <div className={`w-14 h-14 flex items-center justify-center font-mono-jet text-[18px] font-semibold mb-8 border ${s.accent ? "bg-[#e8c547] text-[#080808] border-[#e8c547]" : "bg-[#080808] text-[#f5f0e8] border-[#2a2a2a]"}`}>
                  {s.num}
                </div>
                <h3 className="font-serif-display text-[22px] mb-3">{s.title}</h3>
                <p className="text-[14px] text-[#666] leading-[1.75] mb-4">{s.desc}</p>
                <p className="font-mono-jet text-[11px] text-[#e8c547] tracking-wide">{s.tag}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section id="demo" className="py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="font-mono-jet text-[11px] tracking-[0.15em] text-[#e8c547] uppercase mb-5">Try it now</p>
            <h2 className="font-serif-display text-4xl md:text-5xl leading-[1.1] mb-5">
              See the <em className="italic text-[#e8c547]">magic</em> happen
            </h2>
            <p className="text-[16px] text-[#888] leading-[1.7] mb-10">
              Type a description and FlowCraft instantly drafts your diagram. No setup, no templates.
            </p>
            <div className="bg-[#0d0d0d] border border-[#1e1e1e] p-6">
              <p className="font-mono-jet text-[10px] tracking-[0.15em] text-[#666] uppercase mb-4">Your prompt</p>
              <TypedPrompt />
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => navigate("/login")}
                  className="font-mono-jet text-[11px] font-semibold bg-[#e8c547] text-[#080808] px-5 py-2.5 tracking-widest hover:brightness-110 transition-all"
                >
                  Generate diagram ↗
                </button>
              </div>
            </div>
          </div>
          <div>
            <div className="border border-[#1e1e1e] bg-[#0d0d0d] p-3 min-h-[260px] flex items-center justify-center">
              <div className="w-full h-[240px]">
                <FlowSVG id="demo-svg" nodes={demoNodes} edges={demoEdges} />
              </div>
            </div>
            <p className="font-mono-jet text-[10px] text-[#333] text-right mt-3 tracking-widest">
              GENERATED · 1.4s · 7 NODES
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-32 px-6 md:px-12 text-center border-t border-[#1a1a1a] overflow-hidden">
        <div className="cta-glow absolute inset-0 pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="font-mono-jet text-[11px] tracking-[0.15em] text-[#e8c547] uppercase mb-5">Get started</p>
          <h2 className="font-serif-display text-5xl md:text-7xl leading-[1.05] mb-7">
            Stop explaining.<br />Start <em className="italic">showing.</em>
          </h2>
          <p className="text-[16px] text-[#888] leading-[1.7] max-w-md mx-auto mb-12">
            FlowCraft turns messy thoughts into beautiful diagrams. Free to start, no card required.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="font-mono-jet text-[14px] font-semibold bg-[#f5f0e8] text-[#080808] px-10 py-4 hover:bg-[#e8c547] transition-colors tracking-wide"
          >
            Create your first diagram →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 md:px-12 py-10 border-t border-[#1a1a1a] flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <span className="font-mono-jet text-[14px] text-[#333] tracking-wide">
          flow<span className="text-[#e8c547]">craft</span>
        </span>
        <div className="flex flex-wrap justify-center gap-8">
          {["Features", "Pricing", "Docs", "Privacy"].map((l) => (
            <a key={l} href="#" className="text-[13px] text-[#444] hover:text-[#f5f0e8] transition-colors">
              {l}
            </a>
          ))}
        </div>
        <p className="font-mono-jet text-[11px] text-[#333] tracking-widest">© 2025 FlowCraft</p>
      </footer>
    </div>
  );
}