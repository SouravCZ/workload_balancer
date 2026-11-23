import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/ui";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Interactive Demo", href: "#demo" },
  { label: "FAQ", href: "#faq" },
];

const interactiveTasks = [
  {
    id: "t1",
    title: "Backend API Revamp",
    badge: "Critical Path",
    priority: "High",
    skills: ["Node.js", "Express", "Microservices"],
    bestCandidate: {
      initials: "SJ",
      name: "Sarah Jenkins",
      role: "Staff Backend Engineer",
      currentLoad: 60,
      newLoad: 78,
      fitScore: 98,
      skillMatchPct: 96,
      availabilityScore: 100,
      reasoning:
        "Sarah has top historical throughput for Node.js microservices. With 16 hours of unused bandwidth this sprint, assigning this task minimizes critical path delay with zero overtime risk.",
    },
  },
  {
    id: "t2",
    title: "PostgreSQL Migration & Sharding",
    badge: "Architecture",
    priority: "Critical",
    skills: ["PostgreSQL", "AWS RDS", "Performance Tuning"],
    bestCandidate: {
      initials: "AC",
      name: "Alex Chen",
      role: "Lead Systems Architect",
      currentLoad: 45,
      newLoad: 72,
      fitScore: 94,
      skillMatchPct: 98,
      availabilityScore: 90,
      reasoning:
        "Alex has executed 4 previous zero-downtime DB migrations. At 45% load, he absorbs this 18-hour task while keeping the team well under the burnout threshold.",
    },
  },
  {
    id: "t3",
    title: "Enterprise Design System Sync",
    badge: "Frontend UI",
    priority: "Medium",
    skills: ["React 19", "Tailwind CSS", "Accessibility"],
    bestCandidate: {
      initials: "ER",
      name: "Elena Rostova",
      role: "Senior UI Engineer",
      currentLoad: 65,
      newLoad: 85,
      fitScore: 91,
      skillMatchPct: 94,
      availabilityScore: 88,
      reasoning:
        "Elena maintains our internal core UI token library. Assigning this task ensures WCAG AAA compliance and prevents duplicate token sprawl.",
    },
  },
];

const faqs = [
  {
    q: "How does Equilibrium calculate the Fit Score?",
    a: "Fit Score is a weighted multi-attribute algorithm. 60% of the weight is based on skill overlap and proficiency depth (1-5 scale) against required task competencies. 40% is based on the engineer's real-time availability score. Both components are clearly broken down so the reasoning is never a black box.",
  },
  {
    q: "Does this replace Jira, Linear, or GitHub Issues?",
    a: "No. Equilibrium is an intelligence and decision-support layer that integrates on top of your existing issue trackers. It ingests tickets, calculates capacity dynamics, and suggests optimal assignments without requiring you to switch workflows.",
  },
  {
    q: "Can team leads override the recommendations?",
    a: "Always. Equilibrium provides actionable recommendations with transparent reasoning, but team leads always hold full discretionary control. Overrides are supported with 1-click reassignment.",
  },
  {
    q: "How is Burnout Risk predicted without surveillance?",
    a: "We never use invasive tracking like keystroke monitoring or webcam activity. Burnout prediction is strictly based on objective project telemetry: sustained weekly allocation ratios, consecutive overtime assignments, and task switching friction.",
  },
  {
    q: "Can I try the full system without signing up?",
    a: "Yes! Our live interactive demo environment is pre-loaded with an engineering team (10 members, 18 active tasks). Click 'Get started free' or 'Explore interactive demo' to explore the full suite with zero setup.",
  },
];

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container rounded-full pl-2 pr-3 py-1 text-xs font-label-md font-semibold tracking-wide">
      <span className="w-2 h-2 rounded-full bg-primary-container" />
      {children}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(true);
  const [workEmail, setWorkEmail] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);

  const handleQuickSignup = (e) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  const currentTask = interactiveTasks[selectedTaskIdx];

  return (
    <div className="min-h-screen bg-white text-[#172b4d] font-body-md antialiased selection:bg-[#deebff] selection:text-[#0052cc] overflow-x-hidden">
      {/* Top Banner Announcement */}
      {showBanner && (
        <header className="bg-[#deebff]/70 border-b border-[#b3d4ff] text-[#091e42] py-2 px-4 text-xs font-medium flex items-center justify-center relative z-50">
          <div className="flex items-center gap-1.5 text-center flex-wrap justify-center pr-8 sm:pr-0">
            <span className="bg-[#0052cc] text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider mr-1">
              v2.4
            </span>
            <span>Autonomous Workload Balancer & Real-time Burnout Predictor is now live.</span>
            <a href="#demo" className="text-[#0052cc] hover:text-[#0747a6] underline font-semibold transition-colors">
              Explore interactive demo &rarr;
            </a>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#626f86] hover:text-[#172b4d] rounded transition-colors"
            aria-label="Dismiss banner"
          >
            <Icon name="close" className="text-[16px]" />
          </button>
        </header>
      )}

      {/* Modern Navigation Bar */}
      <nav className="bg-white border-b border-[#ebecf0] sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left Brand and Nav Links */}
          <div className="flex items-center gap-6 lg:gap-10">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
                <Icon name="balance" className="text-[20px]" filled />
              </div>
              <div>
                <span className="font-headline-sm text-lg font-bold tracking-tight block text-primary leading-tight">
                  Equilibrium
                </span>
                <span className="font-label-md text-[9px] text-secondary tracking-widest uppercase block -mt-0.5">
                  Workload Intelligence
                </span>
              </div>
            </Link>

            {/* Menu Items */}
            <div className="hidden md:flex items-center gap-1 text-sm font-medium text-[#172b4d]">
              <a href="#features" className="px-3.5 py-2 rounded-md hover:bg-[#ebecf0] transition-colors text-[#172b4d]">
                Features
              </a>
              <a href="#demo" className="px-3.5 py-2 rounded-md hover:bg-[#ebecf0] transition-colors text-[#172b4d]">
                Interactive Demo
              </a>
              <a href="#faq" className="px-3.5 py-2 rounded-md hover:bg-[#ebecf0] transition-colors text-[#172b4d]">
                FAQ
              </a>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 rounded-full hover:bg-[#ebecf0] text-[#626f86] hover:text-[#172b4d] flex items-center justify-center transition-colors"
              aria-label="Search"
            >
              <Icon name="search" className="text-[20px]" />
            </button>

            <Link
              to="/login"
              className="text-sm font-semibold text-[#172b4d] hover:text-[#0052cc] px-3 py-2 transition-colors"
            >
              Sign in
            </Link>

            <Link
              to="/dashboard"
              className="bg-[#0052cc] hover:bg-[#0747a6] text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-sm transition-all hover:shadow"
            >
              Get started free
            </Link>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg text-secondary hover:text-primary hover:bg-surface-container"
              aria-label="Toggle navigation"
            >
              <Icon name={menuOpen ? "close" : "menu"} className="text-[24px]" />
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {menuOpen && (
          <div className="md:hidden bg-white border-b border-[#ebecf0] px-4 py-6 space-y-3 shadow-lg">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-[#44546f] hover:text-[#0052cc] font-medium"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-[#ebecf0] flex flex-col gap-3">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="w-full text-center py-2.5 font-semibold text-[#172b4d] border border-[#dfe1e6] rounded-full"
              >
                Sign in
              </Link>
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="w-full text-center py-2.5 font-semibold bg-[#0052cc] text-white rounded-full"
              >
                Get started free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Quick Search Dialog Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dfe1e6] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#dfe1e6] flex items-center gap-3">
              <Icon name="search" className="text-[#626f86] text-[22px]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search features, views, or workspaces..."
                className="flex-1 text-[#172b4d] placeholder-[#8590a2] outline-none text-base bg-transparent"
                autoFocus
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="p-1 text-[#626f86] hover:text-[#172b4d] rounded"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              <p className="text-xs font-bold text-[#626f86] uppercase tracking-wider mb-2">Jump to View</p>
              <Link
                to="/dashboard"
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[#f4f5f7] text-[#172b4d] text-sm group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="dashboard" className="text-[#0052cc]" />
                  <span className="font-medium">Operations Dashboard</span>
                </div>
                <Icon name="arrow_forward" className="text-[16px] text-[#626f86] group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/workload"
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[#f4f5f7] text-[#172b4d] text-sm group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="groups" className="text-[#0052cc]" />
                  <span className="font-medium">Team Workload Balancer</span>
                </div>
                <Icon name="arrow_forward" className="text-[16px] text-[#626f86] group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/skill-matrix"
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[#f4f5f7] text-[#172b4d] text-sm group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="psychology" className="text-[#0052cc]" />
                  <span className="font-medium">Competency & Skill Matrix</span>
                </div>
                <Icon name="arrow_forward" className="text-[16px] text-[#626f86] group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/burnout-risk"
                onClick={() => setSearchOpen(false)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[#f4f5f7] text-[#172b4d] text-sm group"
              >
                <div className="flex items-center gap-3">
                  <Icon name="psychiatry" className="text-[#ba1a1a]" />
                  <span className="font-medium">Burnout Risk Fatigue Radar</span>
                </div>
                <Icon name="arrow_forward" className="text-[16px] text-[#626f86] group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modern High-Conversion Hero Section */}
      <main aria-label="Landing Page Main Content">
      <section className="bg-white border-b border-[#ebecf0] pt-12 pb-20 md:pt-16 md:pb-24">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Bold Headline & Context */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-primary text-[44px] sm:text-[56px] lg:text-[64px] font-bold tracking-[-0.03em] leading-[1.08]">
              Turn sprint plans into balanced, agent-ready tasks
            </h1>

            <p className="text-xl sm:text-[22px] text-secondary leading-relaxed max-w-2xl font-normal">
              Then build. Orchestrate engineering bandwidth across your team and agents, with real-time capacity and zero burnout.
            </p>
          </div>

          {/* Right Column: Work Email & Google Signup with Technical Grid Backdrop */}
          <div className="lg:col-span-5 relative">
            <div className="relative p-6 sm:p-8 rounded-2xl border border-[#dfe1e6] bg-white shadow-sm overflow-hidden">
              <div className="absolute right-0 bottom-0 w-52 h-52 hero-grid-pattern opacity-60 pointer-events-none" />

              <form onSubmit={handleQuickSignup} className="relative z-10 space-y-4">
                <div>
                  <label htmlFor="work-email" className="block text-xs font-bold text-[#172b4d] uppercase tracking-wide mb-2">
                    Work email
                  </label>
                  <input
                    id="work-email"
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[#dfe1e6] text-[#172b4d] placeholder-[#8590a2] focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20 outline-none text-base bg-white transition-all shadow-inner"
                  />
                  <p className="text-xs text-[#626f86] mt-2">
                    Interactive Demo Sandbox — Enter any email or proceed directly with one click
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-full bg-[#0052cc] hover:bg-[#0747a6] text-white font-semibold text-base shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                >
                  <span>Enter Interactive Demo</span>
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="w-full border-t border-[#dfe1e6]" />
                  <span className="absolute px-3 bg-white text-xs text-[#626f86] font-medium">
                    Or continue with
                  </span>
                </div>

                <Link
                  to="/dashboard"
                  className="w-full py-3 px-6 rounded-full border border-[#dfe1e6] bg-white hover:bg-[#f4f5f7] text-[#172b4d] font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google (Demo Sandbox)</span>
                </Link>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Column Core Features Section */}
      <section id="features" className="scroll-mt-16 bg-white py-16 md:py-24 border-b border-[#ebecf0]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="max-w-3xl mb-12 sm:mb-16">
            <h2 className="text-[#091e42] text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.15]">
              Built for sustainable engineering delivery
            </h2>
            <p className="text-[#44546f] text-base sm:text-lg mt-3 leading-relaxed">
              Replace intuition and guesswork with deterministic mathematical telemetry. Equilibrium provides real-time capacity balancing, skill depth matching, and burnout prevention.
            </p>
          </div>

          {/* 3-Column Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {/* Feature 1: Workload Balancer & Rebalancing */}
            <div className="flex flex-col">
              <div className="h-[260px] bg-[#0c1017] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border border-[#1e293b]">
                {/* Header status */}
                <div className="flex items-center justify-between text-xs border-b border-[#1e293b] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-semibold text-xs tracking-wide">Dynamic Capacity Rebalancing</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    2 Overloaded
                  </span>
                </div>

                {/* Simulated Donor & Receiver Load Shift */}
                <div className="space-y-3 py-1">
                  {/* Overloaded Donor */}
                  <div className="bg-[#111827] border border-red-500/30 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-200 font-medium">Marcus Kim (Staff Frontend)</span>
                      <span className="text-red-400 font-bold font-mono">135% (54h / 40h)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full w-full" />
                    </div>
                  </div>

                  {/* Transfer indicator chip */}
                  <div className="flex items-center justify-center gap-2 text-[11px] text-[#38bdf8] font-mono">
                    <Icon name="arrow_downward" className="text-[14px] animate-bounce" />
                    <span>Auto-move 14h &bull; GraphQL Schema &bull; 92% fit</span>
                  </div>

                  {/* Underutilized Receiver */}
                  <div className="bg-[#111827] border border-emerald-500/30 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-200 font-medium">Lucas Scott (Fullstack)</span>
                      <span className="text-emerald-400 font-bold font-mono">35% &rarr; 70% (Healthy)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full w-[70%]" />
                    </div>
                  </div>
                </div>

                {/* Footer action badge */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1e293b]">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Icon name="auto_awesome" className="text-[14px] text-sky-400" />
                    Zero overtime risk
                  </span>
                  <span className="text-emerald-400 font-semibold font-mono">Resolved in 1-Click</span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#091e42] mt-6 mb-2 tracking-tight">
                Autonomous Workload Balancer
              </h3>
              <p className="text-[#44546f] text-sm leading-relaxed flex-1">
                Track real-time capacity allocations against 40h sprint baselines. Automated rebalancing detects overloaded donors (&gt;100%) and proposes zero-burnout transfers to underutilized teammates.
              </p>
              <Link
                to="/workload"
                className="text-[#0052cc] hover:text-[#0747a6] font-semibold text-sm inline-flex items-center gap-1.5 mt-4 group"
              >
                <span>Explore Workload Balancer</span>
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            </div>

            {/* Feature 2: Skill Matrix & Fit Scoring */}
            <div className="flex flex-col">
              <div className="h-[260px] bg-[#f0f7ff] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border border-[#dbeafe] hero-grid-pattern">
                {/* Header */}
                <div className="flex items-center justify-between text-xs border-b border-[#dbeafe] pb-2.5 z-10">
                  <span className="font-bold text-[#0f172a] text-xs">Competency Depth & Coverage</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    98% Match Depth
                  </span>
                </div>

                {/* Heatmap Matrix Row Preview */}
                <div className="space-y-2 z-10 py-1">
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-[#e2e8f0] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#0f172a]">Sarah Jenkins</span>
                      <span className="text-[#0052cc] font-mono font-bold">Fit Score: 98%</span>
                    </div>

                    {/* Skill ratings pill row */}
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                      <div className="p-1 rounded bg-[#31433b] text-white font-bold" title="Node.js: Level 5">Node.js [5]</div>
                      <div className="p-1 rounded bg-[#375344] text-white font-medium" title="API Design: Level 4">API [4]</div>
                      <div className="p-1 rounded bg-[#b3ccc0] text-[#091f18]" title="SQL: Level 3">SQL [3]</div>
                      <div className="p-1 rounded bg-[#d3e7dc] text-[#384b42]" title="React: Level 2">React [2]</div>
                    </div>
                  </div>

                  {/* SPOF alert pill */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] text-amber-900">
                    <div className="flex items-center gap-1.5">
                      <Icon name="warning" className="text-amber-600 text-[14px]" />
                      <span className="font-medium">SPOF: Cloud Architecture</span>
                    </div>
                    <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded font-bold">1 Expert</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-[#64748b] pt-2 border-t border-[#dbeafe] z-10">
                  <span>Deterministic Fit: 60% Skill + 40% Headroom</span>
                  <span className="text-[#0052cc] font-bold">100% Explainable</span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#091e42] mt-6 mb-2 tracking-tight">
                Skill Matrix & Fit Scoring
              </h3>
              <p className="text-[#44546f] text-sm leading-relaxed flex-1">
                Replace subjective task assignment with deterministic fit scoring (60% skill proficiency + 40% availability). Spot Single Points of Failure (SPOF) and untapped talent across Technical, Soft, and Domain skills.
              </p>
              <Link
                to="/skill-matrix"
                className="text-[#0052cc] hover:text-[#0747a6] font-semibold text-sm inline-flex items-center gap-1.5 mt-4 group"
              >
                <span>Explore Skill Matrix</span>
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            </div>

            {/* Feature 3: Burnout Risk Fatigue Radar */}
            <div className="flex flex-col">
              <div className="h-[260px] bg-[#fdf2f2]/60 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border border-[#fecaca] shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between text-xs border-b border-[#fecaca] pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Icon name="psychiatry" className="text-[#dc2626] text-[16px]" />
                    <span className="font-bold text-[#991b1b] text-xs">Fatigue & Overtime Radar</span>
                  </div>
                  <span className="bg-[#dc2626] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    High Risk Tier
                  </span>
                </div>

                {/* Fatigue metrics & Streak visual */}
                <div className="space-y-2 py-1">
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-[#fee2e2] space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#0f172a]">Marcus Kim (Staff)</span>
                      <span className="text-[#dc2626] font-mono font-bold">Risk Score: 100/100</span>
                    </div>

                    {/* Streak telemetry */}
                    <div className="flex items-center gap-1 text-[11px] text-[#b91c1c]">
                      <Icon name="timer" className="text-[14px]" />
                      <span>4 consecutive weeks &gt;100% capacity</span>
                    </div>

                    {/* 5-Week historical load sparkline bars */}
                    <div className="flex items-end justify-between gap-1.5 h-7 pt-1">
                      <div className="flex-1 bg-emerald-200 rounded-t h-[65%]" title="W1: 65%" />
                      <div className="flex-1 bg-amber-300 rounded-t h-[85%]" title="W2: 85%" />
                      <div className="flex-1 bg-red-400 rounded-t h-[95%]" title="W3: 110%" />
                      <div className="flex-1 bg-red-500 rounded-t h-[100%]" title="W4: 125%" />
                      <div className="flex-1 bg-red-600 rounded-t h-[100%]" title="W5: 135%" />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-[#991b1b] pt-2 border-t border-[#fecaca]">
                  <span className="flex items-center gap-1">
                    <Icon name="shield" className="text-[14px]" />
                    Zero surveillance telemetry
                  </span>
                  <span className="font-mono font-bold">Early Alert</span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-[#091e42] mt-6 mb-2 tracking-tight">
                Burnout Risk Fatigue Radar
              </h3>
              <p className="text-[#44546f] text-sm leading-relaxed flex-1">
                Objective fatigue assessment without invasive surveillance. Evaluates sustained overtime streaks and capacity overages to alert managers weeks before critical engineers burn out.
              </p>
              <Link
                to="/burnout-risk"
                className="text-[#0052cc] hover:text-[#0747a6] font-semibold text-sm inline-flex items-center gap-1.5 mt-4 group"
              >
                <span>Explore Burnout Radar</span>
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Task Matching Simulator Section */}
      <section id="demo" className="scroll-mt-16 py-16 md:py-24 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <SectionLabel>Live Interactive Simulator</SectionLabel>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-primary">
            Test the AI matching engine right now.
          </h2>
          <p className="font-body-md text-secondary">
            Select an unassigned ticket below to watch Equilibrium calculate the optimal assignee,
            projected capacity changes, and explainable decision telemetry.
          </p>
        </div>

        {/* Task Selector Tabs */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {interactiveTasks.map((task, idx) => (
            <button
              key={task.id}
              onClick={() => setSelectedTaskIdx(idx)}
              className={`p-5 rounded-xl border text-left transition-all ${
                selectedTaskIdx === idx
                  ? "bg-surface-container-lowest border-primary shadow-md ring-1 ring-primary"
                  : "bg-surface-container-low/50 border-outline-variant hover:bg-surface-container-lowest"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-label-md uppercase tracking-wider px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold">
                  {task.badge}
                </span>
                <span className="text-xs font-label-md text-secondary">{task.priority} Priority</span>
              </div>
              <h3 className="font-headline-sm text-sm font-bold text-primary mb-2">{task.title}</h3>
              <div className="flex flex-wrap gap-1">
                {task.skills.map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded bg-surface-container text-secondary">
                    {s}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Interactive Match Breakdown Result */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 md:p-10 card-shadow grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-lg">
                {currentTask.bestCandidate.initials}
              </div>
              <div>
                <h3 className="font-headline-sm text-lg font-bold text-primary">
                  Optimal Match: {currentTask.bestCandidate.name}
                </h3>
                <p className="font-body-sm text-xs text-secondary">{currentTask.bestCandidate.role}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-outline-variant">
                <span className="font-label-md text-[11px] text-secondary uppercase block">
                  Overall Fit
                </span>
                <span className="font-headline-md text-2xl font-bold text-primary block mt-1">
                  {currentTask.bestCandidate.fitScore}%
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-outline-variant">
                <span className="font-label-md text-[11px] text-secondary uppercase block">
                  Skill Match
                </span>
                <span className="font-headline-md text-2xl font-bold text-primary block mt-1">
                  {currentTask.bestCandidate.skillMatchPct}%
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-outline-variant">
                <span className="font-label-md text-[11px] text-secondary uppercase block">
                  Availability
                </span>
                <span className="font-headline-md text-2xl font-bold text-primary block mt-1">
                  {currentTask.bestCandidate.availabilityScore}%
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#FAF9F6] border border-outline-variant space-y-2">
              <div className="flex items-center gap-2 font-label-md text-xs font-bold text-primary">
                <Icon name="auto_awesome" className="text-primary-container text-[16px]" />
                <span>Explainable Match Logic</span>
              </div>
              <p className="font-body-sm text-xs text-secondary leading-relaxed">
                {currentTask.bestCandidate.reasoning}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#FAF9F6] border border-outline-variant rounded-xl p-6 space-y-6">
            <h4 className="font-headline-sm text-sm font-bold text-primary pb-3 border-b border-outline-variant">
              Post-Assignment Impact Projection
            </h4>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-label-md mb-1.5">
                  <span className="text-secondary">Current Utilization</span>
                  <span className="font-bold text-primary">{currentTask.bestCandidate.currentLoad}%</span>
                </div>
                <div className="w-full h-2 bg-secondary-fixed/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full"
                    style={{ width: `${currentTask.bestCandidate.currentLoad}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-label-md mb-1.5">
                  <span className="text-primary font-bold">Projected with Task</span>
                  <span className="font-bold text-primary-container">
                    {currentTask.bestCandidate.newLoad}% (Optimal Band)
                  </span>
                </div>
                <div className="w-full h-2 bg-secondary-fixed/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full"
                    style={{ width: `${currentTask.bestCandidate.newLoad}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/dashboard"
                className="w-full bg-[#0052cc] hover:bg-[#0747a6] text-white font-label-md text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold"
              >
                <Icon name="check" className="text-[16px]" />
                <span>Open in Team Workspace</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-16 py-16 md:py-24 bg-surface-container-low/40 border-t border-outline-variant/60">
        <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop space-y-12">
          <div className="text-center space-y-3">
            <SectionLabel>Transparent Answers</SectionLabel>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-primary">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden card-shadow hover:border-primary transition-colors"
              >
                <summary className="flex items-center justify-between gap-4 p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-headline-sm text-sm font-bold text-primary">{faq.q}</span>
                  <Icon
                    name="expand_more"
                    className="text-[20px] text-secondary flex-shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="px-6 pb-6 text-xs font-body-sm text-secondary leading-relaxed border-t border-outline-variant/40 pt-4">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 md:py-28 px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto bg-primary text-on-primary rounded-3xl p-10 md:p-16 text-center space-y-8 relative overflow-hidden shadow-2xl">
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(40rem 20rem at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 80%)",
            }}
          />

          <div className="relative max-w-2xl mx-auto space-y-4">
            <h2 className="font-display-lg text-3xl sm:text-5xl font-bold tracking-tight">
              Ready to balance your engineering organization?
            </h2>
            <p className="font-body-lg text-secondary-fixed text-base sm:text-lg leading-relaxed">
              Launch our pre-seeded interactive demo with real engineering tasks and members in 1 click.
              No credit card or setup required.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-4 justify-center">
            <Link
              to="/dashboard"
              className="bg-surface-container-lowest hover:bg-surface text-primary font-label-md px-8 py-4 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2 font-bold"
            >
              <span>Launch Live Workspace</span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
            <Link
              to="/login"
              className="border border-on-primary/40 hover:bg-on-primary/10 text-on-primary font-label-md px-8 py-4 rounded-xl transition-colors font-semibold"
            >
              <span>Sign In with Work Email</span>
            </Link>
          </div>
        </div>
      </section>

      </main>

      {/* Clean Footer */}
      <footer className="w-full bg-[#FAF9F6] border-t border-outline-variant/60 py-12">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-8">
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold">
                  <Icon name="balance" className="text-[18px]" filled />
                </div>
                <span className="font-headline-sm text-base font-bold text-primary">Equilibrium</span>
              </div>
              <p className="font-body-sm text-xs text-secondary leading-relaxed">
                Autonomous workload intelligence, explainable fit scoring, and proactive burnout prevention for engineering teams.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-label-md text-xs uppercase tracking-wider text-primary font-bold">
                Platform
              </h3>
              <ul className="space-y-2 text-xs font-body-sm text-secondary">
                <li><Link to="/dashboard" className="hover:text-primary">Dashboard</Link></li>
                <li><Link to="/workload" className="hover:text-primary">Team Workload</Link></li>
                <li><Link to="/tasks" className="hover:text-primary">Task Directory</Link></li>
                <li><Link to="/skill-matrix" className="hover:text-primary">Skill Matrix</Link></li>
                <li><Link to="/burnout-risk" className="hover:text-primary">Burnout Risk</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-label-md text-xs uppercase tracking-wider text-primary font-bold">
                Resources
              </h3>
              <ul className="space-y-2 text-xs font-body-sm text-secondary">
                <li><a href="#features" className="hover:text-primary">Core Features</a></li>
                <li><a href="#demo" className="hover:text-primary">Interactive Simulator</a></li>
                <li><a href="#faq" className="hover:text-primary">FAQ</a></li>
                <li><Link to="/about" className="hover:text-primary">Algorithm Model</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-label-md text-xs uppercase tracking-wider text-primary font-bold">
                System Status
              </h3>
              <div className="flex items-center gap-2 text-xs font-label-md text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>All Systems Operational</span>
              </div>
              <p className="text-[11px] text-secondary">Telemetry engine v2.4 running on Google Cloud.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-body-sm text-secondary">
            <span>&copy; {new Date().getFullYear()} Equilibrium AI Inc. All rights reserved.</span>
            <div className="flex gap-6">
              <Link to="/about" className="hover:text-primary">About & Scoring Specs</Link>
              <Link to="/dashboard" className="hover:text-primary">App Workspace</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
