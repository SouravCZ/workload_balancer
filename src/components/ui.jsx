export function Icon({ name, className = "", filled = false, style }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1", ...style } : style}
    >
      {name}
    </span>
  );
}

export function Card({ className = "", children, as: Tag = "div", ...rest }) {
  return (
    <Tag className={`card-border soft-shadow rounded-card bg-surface ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon, action, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-md ${className}`}>
      <div className="flex items-center gap-sm">
        {icon ? <Icon name={icon} className="text-primary-container text-[20px]" /> : null}
        <div>
          <h3 className="font-headline-sm text-headline-sm text-primary">{title}</h3>
          {subtitle ? (
            <p className="font-body-sm text-body-sm text-secondary mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function KpiCard({ label, value, icon, tone = "neutral", delta, className = "" }) {
  const tones = {
    neutral: "border-outline-variant",
    positive: "border-primary-container/20 bg-primary-container/10",
    warning: "border-error-container bg-error-container/20",
    danger: "border-error/30 bg-error-container/10",
  };
  const valueTone = {
    neutral: "text-on-surface",
    positive: "text-primary",
    warning: "text-error",
    danger: "text-error",
  };
  const iconTone = {
    neutral: "text-secondary",
    positive: "text-primary",
    warning: "text-error",
    danger: "text-error",
  };

  return (
    <div
      className={`rounded-card border p-md soft-shadow flex flex-col justify-between ${tones[tone]} ${className}`}
    >
      <div className="flex items-start justify-between gap-sm">
        <span className="font-label-md text-label-md text-secondary min-w-0 break-words">{label}</span>
        {icon ? (
          <Icon name={icon} className={`text-[18px] flex-shrink-0 ${iconTone[tone]}`} />
        ) : null}
      </div>
      <div className="mt-sm min-w-0">
        <span
          className={`font-headline-md text-headline-md leading-none break-words ${valueTone[tone]}`}
        >
          {value}
        </span>
        {delta ? (
          <span className="block mt-xs font-body-sm text-body-sm text-secondary break-words">
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const chipTones = {
  neutral: "bg-surface-container text-on-surface-variant",
  primary: "bg-primary-container/10 text-primary",
  strong: "bg-primary-container text-on-primary",
  low: "bg-risk-green text-risk-green-ink",
  medium: "bg-risk-amber text-risk-amber-ink",
  high: "bg-risk-red text-risk-red-ink",
  outline: "border border-outline-variant text-secondary",
};

export function Chip({ tone = "neutral", icon, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${chipTones[tone]} ${className}`}
    >
      {icon ? <Icon name={icon} className="text-[14px]" /> : null}
      {children}
    </span>
  );
}

export function riskTone(tier) {
  if (tier === "High") return "high";
  if (tier === "Medium") return "medium";
  return "low";
}

const barTones = {
  healthy: "utilization-bar-fill",
  warning: "bg-[#8C6A1D]",
  danger: "bg-error",
  idle: "bg-outline",
};

export function UtilizationBar({ utilization, className = "", showOverflow = true }) {
  const pct = Math.round(utilization * 100);
  const tone = utilization > 1 ? "danger" : utilization >= 0.85 ? "warning" : utilization < 0.5 ? "idle" : "healthy";
  const overflow = showOverflow && utilization > 1;
  return (
    <div
      className={`w-full h-2 bg-secondary-container rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${barTones[tone]} ${overflow ? "overflow-hatch" : ""}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

const avatarTones = {
  primary: "bg-primary-container text-on-primary",
  "primary-container": "bg-primary-container text-on-primary",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary text-on-tertiary",
  "tertiary-fixed": "bg-tertiary-fixed text-on-tertiary-fixed",
};

export function Avatar({ member, size = "md", className = "" }) {
  const sizes = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-label-md",
    lg: "w-12 h-12 text-headline-sm",
    xl: "w-16 h-16 text-headline-sm",
  };
  if (!member) return null;
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${avatarTones[member.avatarTone] ?? avatarTones.primary} ${sizes[size]} ${className}`}
      title={member.name}
    >
      {member.initials}
    </div>
  );
}

export function SkillTag({ children, className = "" }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[12px] font-medium bg-surface-container text-on-surface-variant ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({ title, description, actions, className = "" }) {
  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-md ${className}`}>
      <div>
        <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          {title}
        </h2>
        {description ? (
          <p className="font-body-md text-body-md text-secondary mt-xs">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-sm">{actions}</div> : null}
    </div>
  );
}
