import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Why Us", href: "#why" },
  { label: "FAQ", href: "#faq" },
];

const heroMembers = [
  { initials: "SJ", name: "Sarah Jenkins", role: "Backend", pct: 62, over: false },
  { initials: "MK", name: "Marcus Kim", role: "Frontend", pct: 118, over: true },
  { initials: "ER", name: "Elena Rostova", role: "Data", pct: 84, over: false },
];

const trustMarks = ["Northwind", "Helio Labs", "Cobalt", "Meridian", "Arcline"];

const problems = [
  {
    icon: "troubleshoot",
    title: "Uneven workload distribution",
    body: "Two engineers are at 120% while three sit under 60%. Nobody notices until someone quits.",
  },
  {
    icon: "heart_broken",
    title: "Burnout that arrives too late",
    body: "By the time it surfaces in a standup, it has already cost you a quarter of the roadmap.",
  },
  {
    icon: "extension_off",
    title: "Skill mismatches",
    body: "Tasks stall on people who lack the skill while experts sit idle on work they are overqualified for.",
  },
];

const solutions = [
  {
    icon: "balance",
    title: "Capacity balancing",
    body: "Live bandwidth for every person, with rebalancing proposals generated automatically.",
  },
  {
    icon: "psychology",
    title: "Explainable fit scores",
    body: "Every assignment is scored on skill overlap and availability, and shows its reasoning.",
  },
  {
    icon: "monitor_heart",
    title: "Early burnout signals",
    body: "Risk scoring tracks sustained over-capacity weeks, not just a single overloaded sprint.",
  },
];

const steps = [
  {
    n: "01",
    icon: "upload_file",
    title: "Connect your team",
    body: "Import members, capacity, and skills. Equilibrium maps your org's real capacity in minutes.",
  },
  {
    n: "02",
    icon: "neurology",
    title: "Let it score the work",
    body: "Every open task is scored against every person on skill fit and remaining bandwidth.",
  },
  {
    n: "03",
    icon: "auto_awesome",
    title: "Act on the reasoning",
    body: "Approve the assignment and load rebalances automatically. Nothing happens in a black box.",
  },
];

const features = [
  {
    icon: "psychology",
    title: "Smart matching",
    body: "Ranks candidates for any task using skill overlap and live availability, not seniority.",
  },
  {
    icon: "balance",
    title: "Capacity balancing",
    body: "Real-time bandwidth per person, with transfer proposals that move hours off overloaded teammates.",
  },
  {
    icon: "monitor_heart",
    title: "Burnout prediction",
    body: "Weights consecutive over-capacity weeks so you see risk building weeks before it peaks.",
  },
  {
    icon: "grid_view",
    title: "Skill gap detection",
    body: "Compares required skills against the whole team and flags single points of failure.",
  },
  {
    icon: "low_priority",
    title: "Priority sequencing",
    body: "Surfaces which tasks sit on the critical path and who can actually absorb them now.",
  },
  {
    icon: "account_tree",
    title: "Explainable AI",
    body: "Plain-language reasoning attached to every recommendation, so managers can audit the call.",
  },
];

const metrics = [
  { value: "31%", label: "fewer missed deadlines" },
  { value: "18h", label: "saved per manager, weekly" },
  { value: "3.2x", label: "faster task assignment" },
  { value: "94%", label: "burnout risk recall" },
];

const faqs = [
  {
    q: "Where does the workload data come from?",
    a: "Equilibrium reads capacity, allocation, and skills from your existing tracker. The demo ships with a realistic mock engineering org so you can explore every screen without connecting anything.",
  },
  {
    q: "How are fit scores calculated?",
    a: "A score blends skill overlap, weighted by proficiency against the task's required skills, with availability derived from remaining capacity. Both halves are shown alongside the score so the reasoning is never hidden.",
  },
  {
    q: "Does assigning a task change someone's load automatically?",
    a: "Yes. Assigning or unassigning moves the estimated hours between owners, and the utilization and risk views update immediately.",
  },
  {
    q: "Can I override a recommendation?",
    a: "Always. Equilibrium proposes, you decide. Every suggestion can be accepted or dismissed, and the reasoning is shown so overrides stay informed.",
  },
  {
    q: "Is this a replacement for our project tracker?",
    a: "No. It sits on top of the tracker you already use and focuses on the decision a tracker does not make for you: who should own this, and is the team able to absorb it.",
  },
];

function SectionLabel({ children }) {
  return (
    <span className="inline-flex items-center gap-sm font-label-md text-label-md text-primary-container uppercase tracking-[0.14em]">
      <span className="w-6 h-px bg-primary-container" />
      {children}
    </span>
  );
}

function HeroRow({ member }) {
  return (
    <div className="flex items-center gap-md">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-label-md text-[11px] flex-shrink-0 ${
          member.over ? "bg-error-container text-error" : "bg-secondary-container text-on-secondary-container"
        }`}
      >
        {member.initials}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="font-body-sm text-body-sm text-on-surface truncate">{member.name}</span>
          <span
            className={`font-label-md text-label-md text-[11px] ml-md flex-shrink-0 ${
              member.over ? "text-error" : "text-secondary"
            }`}
          >
            {member.pct}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${member.over ? "bg-error overflow-hatch" : "utilization-bar-fill"}`}
            style={{ width: `${Math.min(100, member.pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-on-background antialiased">
      <style>{`html { scroll-behavior: smooth; }`}</style>

      <nav className="fixed w-full top-0 z-50 bg-background/85 backdrop-blur-md border-b border-outline-variant/60">
        <div className="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
          <Link to="/" className="flex items-center gap-sm">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <Icon name="view_cozy" className="text-[18px]" filled />
            </div>
            <span className="font-headline-sm text-headline-sm font-bold text-on-background">
              Equilibrium
            </span>
          </Link>

          <div className="hidden md:flex gap-8 items-center font-body-sm text-body-sm">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-secondary hover:text-primary-container transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-md">
            <Link
              to="/login"
              className="font-label-md text-label-md text-secondary hover:text-on-surface transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="bg-primary-container text-on-primary font-label-md px-5 py-2.5 rounded-md hover:bg-primary transition-colors soft-shadow"
            >
              Try Demo
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-md hover:bg-surface-container transition-colors"
          >
            <Icon name={menuOpen ? "close" : "menu"} className="text-[22px]" />
          </button>
        </div>

        {menuOpen ? (
          <div className="md:hidden bg-surface-container-lowest border-t border-outline-variant/60 px-margin-mobile py-md">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block py-3 font-body-sm text-body-sm text-secondary hover:text-primary-container transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-md block w-full text-center bg-primary-container text-on-primary font-label-md text-label-md py-3 rounded-md"
            >
              Try Demo
            </Link>
          </div>
        ) : null}
      </nav>

      <section id="product" className="relative overflow-hidden scroll-mt-20">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.55]"
          style={{
            backgroundImage:
              "radial-gradient(60rem 32rem at 78% 8%, rgba(49,67,59,0.10) 0%, transparent 60%), radial-gradient(40rem 24rem at 4% 92%, rgba(76,99,89,0.08) 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-32 pb-24 md:pt-40 md:pb-32 grid md:grid-cols-2 gap-xl md:gap-gutter items-center">
          <div>
            <div className="inline-flex items-center gap-sm bg-secondary-container text-on-secondary-container rounded-full pl-1.5 pr-md py-1.5 mb-lg">
              <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center">
                <Icon name="auto_awesome" className="text-[14px]" filled />
              </span>
              <span className="font-label-md text-label-md text-[11px]">AI workload intelligence</span>
            </div>

            <h1 className="font-display-lg text-[40px] md:text-[60px] leading-[1.04] tracking-[-0.03em] mb-lg">
              Balance your team's
              <br />
              workload{" "}
              <span className="text-primary-container">before it becomes burnout.</span>
            </h1>

            <p className="font-body-lg text-body-lg text-secondary mb-xl max-w-lg">
              Equilibrium matches every task to the right person, surfaces capacity risk early, and
              shows its reasoning — so managers stop guessing and teams stop burning out.
            </p>

            <div className="flex flex-wrap gap-md mb-xl">
              <Link
                to="/login"
                className="bg-primary-container text-on-primary font-label-md px-7 py-3.5 rounded-md hover:bg-primary transition-colors soft-shadow inline-flex items-center gap-sm"
              >
                Try the demo
                <Icon name="arrow_forward" className="text-[18px]" />
              </Link>
              <a
                href="#how-it-works"
                className="border border-outline-variant bg-surface-container-lowest text-on-background font-label-md px-7 py-3.5 rounded-md hover:bg-surface-container transition-colors inline-flex items-center gap-sm"
              >
                See how it works
              </a>
            </div>

            <div className="flex flex-wrap gap-xl pt-lg border-t border-outline-variant/60">
              {[
                { value: "31%", label: "fewer missed deadlines" },
                { value: "18h", label: "saved per manager" },
                { value: "3.2x", label: "faster assignment" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-headline-md text-headline-md text-primary leading-none">
                    {stat.value}
                  </div>
                  <div className="font-body-sm text-body-sm text-secondary mt-1.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg soft-shadow">
              <div className="flex justify-between items-center mb-lg pb-md border-b border-outline-variant/60">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-primary leading-tight">
                    Team Workload
                  </h3>
                  <p className="font-body-sm text-body-sm text-secondary text-[12px] mt-0.5">
                    Live capacity across 8 members
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-risk-green text-risk-green-ink rounded-full px-2.5 py-1 font-label-md text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-risk-green-ink" />
                  Live
                </span>
              </div>

              <div className="space-y-md">
                {heroMembers.map((member) => (
                  <HeroRow key={member.name} member={member} />
                ))}
              </div>

              <div className="mt-lg bg-surface-container-low border border-outline-variant rounded-lg p-md flex items-start gap-sm">
                <Icon name="auto_awesome" className="text-primary-container text-[18px] flex-shrink-0" filled />
                <div>
                  <span className="block font-label-md text-label-md text-[11px] text-on-surface mb-1">
                    Recommended rebalance
                  </span>
                  <span className="block font-body-sm text-body-sm text-secondary text-[12px] leading-relaxed">
                    Move 2 backend tasks from Marcus to Sarah. Fit score 0.81, and Marcus drops from
                    118% to 94% capacity.
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex absolute -bottom-6 -left-6 bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-3 lift-shadow items-center gap-sm">
              <Icon name="check_circle" className="text-[18px] text-primary-container" filled />
              <div>
                <span className="block font-label-md text-label-md text-[10px] text-secondary">
                  Skill coverage
                </span>
                <span className="block font-headline-sm text-headline-sm text-primary leading-tight">
                  94% covered
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-outline-variant/60 bg-surface-container-low/50">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-lg">
          <p className="text-center font-label-md text-label-md text-[11px] text-secondary uppercase tracking-[0.14em] mb-md">
            Keeping teams balanced at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-xl gap-y-md">
            {trustMarks.map((mark) => (
              <span
                key={mark}
                className="font-headline-sm text-headline-sm text-on-surface-variant opacity-60"
              >
                {mark}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="scroll-mt-20 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        <div className="max-w-2xl mb-16">
          <SectionLabel>The balancing act</SectionLabel>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg mt-md mb-md">
            Invisible workloads are the expensive kind.
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Most teams don't have a productivity problem. They have a distribution problem — and it
            only becomes visible once something breaks.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg md:p-xl soft-shadow">
            <h3 className="font-headline-sm text-headline-sm text-error flex items-center gap-sm mb-lg">
              <span className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
                <Icon name="warning" className="text-[18px]" />
              </span>
              Without Equilibrium
            </h3>
            <div className="space-y-lg">
              {problems.map((item) => (
                <div key={item.title} className="flex gap-md">
                  <Icon
                    name={item.icon}
                    className="text-[20px] text-error flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface mb-1">
                      {item.title}
                    </h4>
                    <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg md:p-xl soft-shadow">
            <h3 className="font-headline-sm text-headline-sm text-primary flex items-center gap-sm mb-lg">
              <span className="w-8 h-8 rounded-lg bg-secondary-container text-primary-container flex items-center justify-center">
                <Icon name="check_circle" className="text-[18px]" />
              </span>
              With Equilibrium
            </h3>
            <div className="space-y-lg">
              {solutions.map((item) => (
                <div key={item.title} className="flex gap-md">
                  <Icon
                    name={item.icon}
                    className="text-[20px] text-primary-container flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <h4 className="font-body-md text-body-md font-semibold text-on-surface mb-1">
                      {item.title}
                    </h4>
                    <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 bg-surface-container-low/50 border-y border-outline-variant/60"
      >
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
          <div className="max-w-2xl mb-16">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg mt-md mb-md">
              Three steps to a balanced team.
            </h2>
            <p className="font-body-md text-body-md text-secondary">
              No migration project, no new process to adopt. Equilibrium reads the capacity you
              already track and turns it into decisions.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-lg">
            {steps.map((step) => (
              <div
                key={step.n}
                className="relative bg-surface-container-lowest border border-outline-variant rounded-xl p-lg soft-shadow card-hover-shadow transition-shadow"
              >
                <div className="flex items-center justify-between mb-lg">
                  <span className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                    <Icon name={step.icon} className="text-[20px]" />
                  </span>
                  <span className="font-headline-lg text-headline-lg text-outline-variant/50 leading-none">
                    {step.n}
                  </span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-sm">{step.title}</h3>
                <p className="font-body-sm text-body-sm text-secondary leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        <div className="max-w-2xl mb-16">
          <SectionLabel>Capabilities</SectionLabel>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg mt-md mb-md">
            Everything you need to run a healthy team.
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Six tools that share one view of capacity, skills, and risk.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-surface-container-lowest border border-outline-variant rounded-xl p-lg soft-shadow card-hover-shadow transition-all hover:-translate-y-0.5 hover:border-primary-container/40"
            >
              <span className="w-10 h-10 rounded-lg bg-surface-container text-primary-container flex items-center justify-center mb-lg group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
                <Icon name={feature.icon} className="text-[20px]" />
              </span>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-sm">{feature.title}</h3>
              <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-on-primary">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center lg:text-left">
                <div className="font-display-lg text-[44px] leading-none tracking-[-0.02em]">
                  {metric.value}
                </div>
                <div className="font-body-sm text-body-sm opacity-75 mt-2">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-md">
            <SectionLabel>FAQ</SectionLabel>
          </div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg">
            Questions, answered.
          </h2>
        </div>

        <div className="space-y-sm">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden soft-shadow hover:border-primary-container/40 transition-colors"
            >
              <summary className="flex items-center justify-between gap-md px-lg py-md cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="font-body-md text-body-md font-semibold text-on-surface">
                  {faq.q}
                </span>
                <Icon
                  name="expand_more"
                  className="text-[20px] text-secondary flex-shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="px-lg pb-md font-body-sm text-body-sm text-secondary leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-margin-mobile md:px-margin-desktop pb-24 md:pb-32">
        <div className="max-w-container-max mx-auto relative overflow-hidden bg-primary-container text-on-primary rounded-xl px-gutter py-20 text-center">
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(30rem 20rem at 50% 0%, rgba(255,255,255,0.35) 0%, transparent 65%)",
            }}
          />
          <div className="relative">
            <h2 className="font-headline-lg-mobile md:font-headline-xl text-headline-lg-mobile md:text-headline-xl tracking-[-0.02em] mb-md">
              Balance your team in seconds.
            </h2>
            <p className="font-body-lg text-body-lg opacity-85 mb-xl max-w-xl mx-auto">
              Stop guessing who has room. Open the demo and watch a real team rebalance itself.
            </p>
            <div className="flex flex-wrap gap-md justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-sm bg-surface-container-lowest text-primary-container font-label-md px-8 py-3.5 rounded-md hover:bg-surface transition-colors soft-shadow"
              >
                Get started now
                <Icon name="arrow_forward" className="text-[18px]" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-sm border border-on-primary/35 font-label-md px-8 py-3.5 rounded-md hover:bg-on-primary/10 transition-colors"
              >
                Talk through it
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full bg-surface-container-low border-t border-outline-variant/60">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-lg mb-xl">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-sm mb-md">
                <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                  <Icon name="view_cozy" className="text-[18px]" filled />
                </div>
                <span className="font-headline-sm text-headline-sm font-bold">Equilibrium</span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary leading-relaxed max-w-xs">
                Balancing productivity and well-being for engineering teams.
              </p>
            </div>

            <div className="flex flex-col gap-sm">
              <span className="font-label-md text-label-md text-[11px] uppercase tracking-[0.14em] text-on-surface mb-1">
                Product
              </span>
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-body-sm text-body-sm text-secondary hover:text-primary-container transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-sm">
              <span className="font-label-md text-label-md text-[11px] uppercase tracking-[0.14em] text-on-surface mb-1">
                Get started
              </span>
              <Link
                to="/login"
                className="font-body-sm text-body-sm text-secondary hover:text-primary-container transition-colors"
              >
                Try the demo
              </Link>
              <Link
                to="/login"
                className="font-body-sm text-body-sm text-secondary hover:text-primary-container transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/dashboard"
                className="font-body-sm text-body-sm text-secondary hover:text-primary-container transition-colors"
              >
                Open dashboard
              </Link>
            </div>

            <div className="flex flex-col gap-sm">
              <span className="font-label-md text-label-md text-[11px] uppercase tracking-[0.14em] text-on-surface mb-1">
                Company
              </span>
              {["Privacy Policy", "Terms of Service", "Security"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="font-body-sm text-body-sm text-secondary hover:text-primary-container transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>

          <div className="pt-lg border-t border-outline-variant/60 flex flex-col sm:flex-row gap-sm sm:items-center sm:justify-between">
            <span className="font-body-sm text-body-sm text-secondary">
              &copy; {new Date().getFullYear()} Equilibrium AI
            </span>
            <span className="font-body-sm text-body-sm text-secondary flex items-center gap-1.5">
              <Icon name="lock" className="text-[14px]" />
              Your data stays private and secure.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
