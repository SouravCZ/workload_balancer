import argparse
import json
import os
import tempfile
from pathlib import Path

# Ensure Matplotlib doesn't crash on Windows permission restrictions
os.environ["MPLCONFIGDIR"] = tempfile.gettempdir()

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

SKILL_NAMES = [
    "Node.js",
    "React",
    "SQL",
    "Python",
    "Leadership",
    "Problem Solving",
    "API Design",
    "Cloud Architecture",
]

ROLES = ["Frontend", "Backend", "Data", "QA", "DevOps"]

# Typical role affinity boosts for realistic skill profiles
ROLE_SKILL_AFFINITY = {
    "Frontend": {"React": 2, "Node.js": 1, "Problem Solving": 1},
    "Backend": {"Node.js": 2, "SQL": 2, "API Design": 2, "Python": 1},
    "Data": {"SQL": 2, "Python": 2, "Cloud Architecture": 1},
    "QA": {"Problem Solving": 2, "API Design": 1, "Python": 1},
    "DevOps": {"Cloud Architecture": 2, "Python": 1, "API Design": 1},
}


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -25.0, 25.0)))


def fit_jira_marginals(jira_path: Path):
    if not jira_path.exists():
        alt = jira_path.parent / "issues.csv"
        if alt.exists():
            jira_path = alt
        else:
            return None
    try:
        df = pd.read_csv(jira_path)
        col_map = {c.lower(): c for c in df.columns}
        created_col = col_map.get("created") or col_map.get("created_date") or col_map.get("created_at")
        resolved_col = col_map.get("resolved") or col_map.get("resolutiondate") or col_map.get("resolution_date")
        priority_col = col_map.get("priority")

        # Fit priority probabilities
        p_probs = [0.20, 0.40, 0.25, 0.15]
        if priority_col:
            prios = df[priority_col].dropna().astype(str).str.lower()
            def map_p(p):
                if any(k in p for k in ["trivial", "minor", "low", "1"]):
                    return 1
                elif any(k in p for k in ["major", "normal", "medium", "2"]):
                    return 2
                elif any(k in p for k in ["critical", "high", "3"]):
                    return 3
                elif any(k in p for k in ["blocker", "urgent", "4"]):
                    return 4
                return 2
            mapped = prios.apply(map_p)
            counts = mapped.value_counts(normalize=True).to_dict()
            p_probs = [counts.get(1, 0.20), counts.get(2, 0.40), counts.get(3, 0.25), counts.get(4, 0.15)]
            total = sum(p_probs)
            p_probs = [p / total for p in p_probs]

        # Fit duration quantiles scaled to estimated_hours
        duration_means = None
        if created_col and resolved_col:
            v_df = df.dropna(subset=[created_col, resolved_col]).copy()
            v_df["dt1"] = pd.to_datetime(v_df[created_col], errors="coerce")
            v_df["dt2"] = pd.to_datetime(v_df[resolved_col], errors="coerce")
            v_df = v_df.dropna(subset=["dt1", "dt2"])
            hours = (v_df["dt2"] - v_df["dt1"]).dt.total_seconds() / 3600.0
            hours = hours[hours > 0]
            if len(hours) >= 50:
                q = hours.quantile([0.10, 0.30, 0.50, 0.70, 0.90]).values
                min_h, max_h = 6.0, 48.0
                norm_q = (q - q.min()) / max(1e-5, (q.max() - q.min()))
                duration_means = {i + 1: float(min_h + norm_q[i] * (max_h - min_h)) for i in range(5)}

        return {"priority_probs": p_probs, "duration_means": duration_means}
    except Exception as e:
        print(f"[CALIBRATION ERROR] Failed parsing Jira dataset: {e}")
        return None


def generate_dataset(seed: int = 42, n_members: int = 300, n_tasks: int = 4000, calibrate_from_real: bool = False):
    rng = np.random.RandomState(seed)

    data_dir = Path("ml/data")
    reports_dir = Path("ml/reports")
    data_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    # ----------------------------------------------------
    # Table A: Members
    # ----------------------------------------------------
    members = []
    for i in range(1, n_members + 1):
        member_id = f"m_{i:03d}"
        role = rng.choice(ROLES)
        seniority = rng.choice([1, 2, 3, 4, 5], p=[0.15, 0.25, 0.30, 0.20, 0.10])

        # Experience years correlated with seniority (plus noise)
        exp_mean = {1: 1.5, 2: 3.5, 3: 6.0, 4: 9.5, 5: 14.0}[seniority]
        exp_years = max(0.5, round(float(rng.normal(exp_mean, 1.0)), 1))

        # Tenure months in current company
        tenure_months = int(np.clip(rng.gamma(shape=2.5, scale=exp_years * 2.5), 1, 120))

        # Weekly capacity: typical engineering bands (30 to 45 hours)
        weekly_capacity_hrs = int(rng.choice([32, 35, 40, 40, 40, 45], p=[0.05, 0.10, 0.65, 0.10, 0.05, 0.05]))

        # Skills proficiencies (0-5)
        member_skills = {}
        for s in SKILL_NAMES:
            base_prof = int(np.clip(round(rng.normal(seniority * 0.8, 0.9)), 0, 5))
            boost = ROLE_SKILL_AFFINITY[role].get(s, 0)
            final_prof = int(np.clip(base_prof + (1 if rng.rand() < 0.6 and boost > 0 else 0), 0, 5))
            member_skills[s] = final_prof

        # Recent PTO days (0-15)
        recent_pto_days = int(np.clip(rng.poisson(lam=2.5), 0, 15))

        # Skewed baseline utilization: most 60-95%, right tail > 100%
        base_util = float(np.clip(rng.beta(a=5, b=2.5) * 1.35, 0.25, 1.45))
        current_allocated_hrs = round(base_util * weekly_capacity_hrs, 1)

        # Weekly load history (5 weeks, percentages e.g. 75, 105)
        # Create correlated walk
        load_hist = []
        curr_load = base_util * 100
        for _ in range(5):
            curr_load = float(np.clip(curr_load + rng.normal(0, 8), 30, 160))
            load_hist.append(round(curr_load, 1))

        avg_overtime_hrs = max(0.0, round(float(np.mean([max(0, l - 100) * weekly_capacity_hrs / 100 for l in load_hist])), 1))

        row = {
            "member_id": member_id,
            "role": role,
            "seniority": seniority,
            "experience_years": exp_years,
            "tenure_months": tenure_months,
            "weekly_capacity_hrs": weekly_capacity_hrs,
            "current_allocated_hrs": current_allocated_hrs,
            "recent_pto_days": recent_pto_days,
            "avg_overtime_hrs": avg_overtime_hrs,
            "weekly_load_history": json.dumps(load_hist),
        }
        for s in SKILL_NAMES:
            row[f"skill_{s}"] = member_skills[s]

        members.append(row)

    df_members = pd.DataFrame(members)
    df_members.to_csv(data_dir / "members.csv", index=False)

    # ----------------------------------------------------
    # Table B: Tasks
    # ----------------------------------------------------
    calibrated_marginals = None
    if calibrate_from_real:
        jira_path = Path("ml/data/real/jira_issues.csv")
        calibrated_marginals = fit_jira_marginals(jira_path)
        print("=" * 60)
        if calibrated_marginals:
            print("[CALIBRATION ENABLED] Task marginals calibrated from real Jira data:")
            print(f"  Priority mix (Low, Med, High, Crit): {[round(p, 3) for p in calibrated_marginals['priority_probs']]}")
        else:
            print("[CALIBRATION NOTICE] Real Jira data not found at ml/data/real/jira_issues.csv. Falling back to default synthetic distributions.")
        print("Calibrated columns: task priority, estimated_hours (from Jira).")
        print("Synthetic columns: skills, member roster, tenure, outcome labels (burnout, on_time, quality).")
        print("=" * 60)

    tasks = []
    for j in range(1, n_tasks + 1):
        task_id = f"t_{j:04d}"
        complexity = rng.choice([1, 2, 3, 4, 5], p=[0.15, 0.25, 0.30, 0.20, 0.10])

        if calibrate_from_real and calibrated_marginals:
            est_mean = calibrated_marginals["duration_means"].get(complexity, {1: 6, 2: 12, 3: 20, 4: 32, 5: 48}[complexity]) if calibrated_marginals.get("duration_means") else {1: 6, 2: 12, 3: 20, 4: 32, 5: 48}[complexity]
            estimated_hours = int(np.clip(round(rng.normal(est_mean, 4)), 2, 60))
            priority = rng.choice([1, 2, 3, 4], p=calibrated_marginals["priority_probs"])
        else:
            # Estimated hours correlated with complexity
            est_mean = {1: 6, 2: 12, 3: 20, 4: 32, 5: 48}[complexity]
            estimated_hours = int(np.clip(round(rng.normal(est_mean, 4)), 2, 60))
            priority = rng.choice([1, 2, 3, 4], p=[0.20, 0.40, 0.25, 0.15])  # 1: Low, 2: Medium, 3: High, 4: Critical
        deadline_days = max(1, int(round((estimated_hours / 7.0) * rng.uniform(0.7, 2.0))))
        collaboration_needed = int(rng.choice([0, 1], p=[0.60, 0.40] if complexity <= 2 else [0.30, 0.70]))

        # Select 1 to 3 required skills with required level (1-5)
        num_skills = rng.choice([1, 2, 3], p=[0.40, 0.45, 0.15])
        chosen_skills = rng.choice(SKILL_NAMES, size=num_skills, replace=False)
        req_skills_dict = {}
        for s in chosen_skills:
            req_level = int(np.clip(round(rng.normal(complexity * 0.85, 0.7)), 1, 5))
            req_skills_dict[s] = req_level

        tasks.append({
            "task_id": task_id,
            "complexity": complexity,
            "estimated_hours": estimated_hours,
            "priority": priority,
            "deadline_days": deadline_days,
            "collaboration_needed": collaboration_needed,
            "required_skills": json.dumps(req_skills_dict),
        })

    df_tasks = pd.DataFrame(tasks)
    df_tasks.to_csv(data_dir / "tasks.csv", index=False)

    # ----------------------------------------------------
    # Table C: Assignments (Training table)
    # ----------------------------------------------------
    assignments = []
    # Sample 10,000 candidate assignment interactions across members and tasks
    n_assignments = 10000

    member_dict = {m["member_id"]: m for m in members}
    task_dict = {t["task_id"]: t for t in tasks}

    member_ids = list(member_dict.keys())
    task_ids = list(task_dict.keys())

    for k in range(n_assignments):
        m_id = member_ids[k % len(member_ids)] if k < len(member_ids) else rng.choice(member_ids)
        t_id = task_ids[k % len(task_ids)] if k < len(task_ids) else rng.choice(task_ids)

        m = member_dict[m_id]
        t = task_dict[t_id]

        req_skills = json.loads(t["required_skills"])
        weekly_history = json.loads(m["weekly_load_history"])

        # Skill features
        gaps = []
        matches = []
        covered_count = 0
        for s_name, req_lvl in req_skills.items():
            member_lvl = m.get(f"skill_{s_name}", 0)
            gap = max(0, req_lvl - member_lvl)
            gaps.append(gap)
            matches.append(min(1.0, member_lvl / max(1, req_lvl)))
            if member_lvl >= req_lvl:
                covered_count += 1

        skill_match_score = float(np.mean(matches)) if matches else 1.0
        skill_gap_max = int(np.max(gaps)) if gaps else 0
        skill_coverage_ratio = float(covered_count / len(req_skills)) if req_skills else 1.0

        current_util = m["current_allocated_hrs"] / m["weekly_capacity_hrs"]
        projected_util = (m["current_allocated_hrs"] + t["estimated_hours"]) / m["weekly_capacity_hrs"]

        remaining_headroom = max(0.5, m["weekly_capacity_hrs"] - m["current_allocated_hrs"])
        task_hours_to_headroom_ratio = round(t["estimated_hours"] / remaining_headroom, 3)

        deadline_capacity_hrs = max(4.0, t["deadline_days"] * 7.5)
        hours_to_deadline_ratio = round(t["estimated_hours"] / deadline_capacity_hrs, 3)

        seniority_vs_complexity = m["seniority"] - t["complexity"]

        # Overtime trend (slope over 5 weeks)
        x_weeks = np.array([1, 2, 3, 4, 5])
        slope, _ = np.polyfit(x_weeks, weekly_history, 1)
        overtime_trend = round(float(slope), 2)

        overload_streak_weeks = sum(1 for load in weekly_history if load > 100.0)
        recent_pto = m["recent_pto_days"]
        tenure = m["tenure_months"]
        priority = t["priority"]
        collab = t["collaboration_needed"]
        concurrent_task_count = rng.choice([1, 2, 3, 4, 5, 6], p=[0.15, 0.30, 0.25, 0.15, 0.10, 0.05])

        # ----------------------------------------------------
        # Ground Truth Generator (Nonlinear Interactions & Cognitive Dynamics)
        # ----------------------------------------------------

        # Target 1: outcome_quality (0-100 continuous)
        base_quality = 70.0 + (skill_match_score * 20.0) + (seniority_vs_complexity * 4.0) - (skill_gap_max * 7.0)

        # Nonlinear penalty: high overload degrades quality severely
        overload_fatigue_penalty = 0.0
        if projected_util > 1.05:
            overload_fatigue_penalty = 30.0 * ((projected_util - 1.05) ** 1.3)

        # Context-switching friction: collaboration + many concurrent tasks
        context_switching_penalty = 0.0
        if collab == 1 and concurrent_task_count >= 4:
            context_switching_penalty = 6.0 + 2.0 * (concurrent_task_count - 3)

        # Tight deadline stress penalty
        tight_deadline_penalty = 6.0 if hours_to_deadline_ratio > 1.2 else 0.0

        # Unobserved real-world engineering friction (technical debt, dependency churn, interruptions)
        unobserved_factors = rng.normal(0, 13.5)
        raw_quality = base_quality - overload_fatigue_penalty - context_switching_penalty - tight_deadline_penalty + unobserved_factors
        outcome_quality = float(np.clip(raw_quality, 0.0, 100.0))

        # Target 2: on_time (0 or 1)
        # Driven by capacity margin, deadline ratio, and execution speed
        on_time_logit = (
            2.2
            - (2.8 * max(0.0, hours_to_deadline_ratio - 0.7))
            - (3.5 * max(0.0, projected_util - 1.0))
            + (1.2 * skill_coverage_ratio)
            + (0.35 * seniority_vs_complexity)
            - (0.6 * max(0, concurrent_task_count - 3))
            + rng.normal(0, 0.4)
        )
        p_on_time = sigmoid(on_time_logit)
        on_time = 1 if rng.rand() < p_on_time else 0
        # ~5% random noise/flips for external blockers
        if rng.rand() < 0.05:
            on_time = 1 - on_time

        # Target 3: burnout_flag (0 or 1)
        # Nonlinear escalation: sustained streak + projected utilization + high priority + lack of PTO
        streak_factor = (overload_streak_weeks / 5.0) ** 1.4
        overage_factor = max(0.0, projected_util - 0.95) ** 1.3
        pto_protection = max(0.0, (recent_pto - 2.0) * 0.25)
        trend_factor = max(0.0, overtime_trend * 0.08)

        burnout_logit = (
            -6.55
            + (4.2 * overage_factor)
            + (2.6 * streak_factor)
            + (0.35 * priority)
            + (0.4 * trend_factor)
            - (1.5 * pto_protection)
            + (0.25 if concurrent_task_count >= 5 else 0.0)
            + rng.normal(0, 0.35)
        )
        p_burnout = sigmoid(burnout_logit)
        burnout_flag = 1 if rng.rand() < p_burnout else 0
        if rng.rand() < 0.03:
            burnout_flag = 1 - burnout_flag

        assignments.append({
            "member_id": m_id,
            "task_id": t_id,
            "skill_match_score": round(skill_match_score, 4),
            "skill_gap_max": skill_gap_max,
            "skill_coverage_ratio": round(skill_coverage_ratio, 4),
            "current_utilization": round(current_util, 4),
            "projected_utilization_after_assign": round(projected_util, 4),
            "task_hours_to_headroom_ratio": task_hours_to_headroom_ratio,
            "hours_to_deadline_ratio": hours_to_deadline_ratio,
            "seniority_vs_complexity": seniority_vs_complexity,
            "overtime_trend": overtime_trend,
            "overload_streak_weeks": overload_streak_weeks,
            "recent_pto_days": recent_pto,
            "tenure_months": tenure,
            "task_priority": priority,
            "collaboration_needed": collab,
            "concurrent_task_count": concurrent_task_count,
            "outcome_quality": round(outcome_quality, 2),
            "on_time": on_time,
            "burnout_flag": burnout_flag,
        })

    df_assign = pd.DataFrame(assignments)

    # Inject ~2% missing values on non-target features to satisfy realism rule
    missing_candidate_cols = ["overtime_trend", "task_hours_to_headroom_ratio", "recent_pto_days"]
    for col in missing_candidate_cols:
        mask = rng.rand(len(df_assign)) < 0.02
        df_assign.loc[mask, col] = np.nan

    df_assign.to_csv(data_dir / "assignments.csv", index=False)

    # ----------------------------------------------------
    # Summary, Verification & Visualizations
    # ----------------------------------------------------
    burnout_rate = float(df_assign["burnout_flag"].mean())
    on_time_rate = float(df_assign["on_time"].mean())
    avg_quality = float(df_assign["outcome_quality"].mean())

    summary = {
        "seed": seed,
        "n_members": len(df_members),
        "n_tasks": len(df_tasks),
        "n_assignments": len(df_assign),
        "burnout_rate": round(burnout_rate, 4),
        "on_time_rate": round(on_time_rate, 4),
        "mean_outcome_quality": round(avg_quality, 2),
        "missing_values_count": int(df_assign.isna().sum().sum()),
        "features": [c for c in df_assign.columns if c not in ["member_id", "task_id", "outcome_quality", "on_time", "burnout_flag"]],
        "targets": ["outcome_quality", "on_time", "burnout_flag"],
    }

    with open(reports_dir / "data_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Plot 1: Target Class Balance & Quality Distribution
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    df_assign["burnout_flag"].value_counts(normalize=True).plot.bar(ax=axes[0], color=["#4c6359", "#ba1a1a"])
    axes[0].set_title(f"Burnout Flag Balance ({burnout_rate*100:.1f}% Pos)")
    axes[0].set_xticklabels(["No Burnout (0)", "Burnout (1)"], rotation=0)

    df_assign["on_time"].value_counts(normalize=True).plot.bar(ax=axes[1], color=["#ba1a1a", "#2563eb"])
    axes[1].set_title(f"On-Time Completion ({on_time_rate*100:.1f}% Pos)")
    axes[1].set_xticklabels(["Delayed (0)", "On Time (1)"], rotation=0)

    df_assign["outcome_quality"].plot.hist(bins=30, ax=axes[2], color="#0d9488", edgecolor="black")
    axes[2].set_title(f"Outcome Quality Distribution (Mean: {avg_quality:.1f})")
    plt.tight_layout()
    plt.savefig(reports_dir / "class_balance.png", dpi=150)
    plt.close()

    # Plot 2: Correlation Matrix
    numeric_cols = df_assign.select_dtypes(include=[np.number]).columns
    corr = df_assign[numeric_cols].corr()

    fig, ax = plt.subplots(figsize=(12, 10))
    cax = ax.matshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
    fig.colorbar(cax)
    ax.set_xticks(range(len(numeric_cols)))
    ax.set_yticks(range(len(numeric_cols)))
    ax.set_xticklabels(numeric_cols, rotation=90, fontsize=8)
    ax.set_yticklabels(numeric_cols, fontsize=8)
    plt.title("Synthetic Telemetry Correlation Matrix", pad=20)
    plt.tight_layout()
    plt.savefig(reports_dir / "correlation_matrix.png", dpi=150)
    plt.close()

    print("=" * 60)
    print("PHASE 2 DATASET GENERATION SUMMARY")
    print("=" * 60)
    print(f"Members:      {len(df_members)} rows ({data_dir / 'members.csv'})")
    print(f"Tasks:        {len(df_tasks)} rows ({data_dir / 'tasks.csv'})")
    print(f"Assignments:  {len(df_assign)} rows ({data_dir / 'assignments.csv'})")
    print(f"Burnout Rate: {burnout_rate*100:.2f}% (Target: 12-20%)")
    print(f"On-Time Rate: {on_time_rate*100:.2f}%")
    print(f"Mean Quality: {avg_quality:.2f} / 100")
    print(f"Missing vals: {summary['missing_values_count']} injected (~2%)")
    print(f"Reports & plots saved to {reports_dir}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n_members", type=int, default=300)
    parser.add_argument("--n_tasks", type=int, default=4000)
    parser.add_argument(
        "--calibrate-from-real",
        action="store_true",
        help="Fit task marginals (priority and duration) from empirical Jira dataset if available",
    )
    args = parser.parse_args()

    generate_dataset(
        seed=args.seed,
        n_members=args.n_members,
        n_tasks=args.n_tasks,
        calibrate_from_real=args.calibrate_from_real,
    )
