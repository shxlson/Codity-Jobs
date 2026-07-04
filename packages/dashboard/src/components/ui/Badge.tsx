import React from "react";

interface BadgeProps {
  status: string;
  label?: string;
  dot?: boolean;
}

const STATUS_DOTS: Record<string, string> = {
  queued:    "#AAAAB2",
  scheduled: "#8BB5D0",
  claimed:   "#A898D0",
  running:   "#E8913A",
  completed: "#5ABF82",
  failed:    "#D05858",
  retrying:  "#D4A040",
  dead:      "#8A3A3A",
  active:    "#5ABF82",
  idle:      "#AAAAB2",
  draining:  "#D4A040",
  offline:   "#8A3A3A",
};

export function StatusBadge({ status, label, dot = true }: BadgeProps) {
  const cls = `badge badge-${status}`;
  const dotColor = STATUS_DOTS[status] ?? "#888";

  return (
    <span className={cls}>
      {dot && (
        <span
          className="badge-dot"
          style={{ background: dotColor }}
        />
      )}
      {label ?? status}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: number;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  let label = "Normal";
  let color = "var(--text-tertiary)";

  if (priority >= 100) { label = "Critical"; color = "#D05858"; }
  else if (priority >= 50) { label = "High"; color = "#E8913A"; }
  else if (priority >= 10) { label = "Medium"; color = "#D4A040"; }

  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color,
        letterSpacing: "0.02em",
      }}
    >
      {priority > 0 ? `P${priority}` : label}
    </span>
  );
}
