// ─────────────────────────────────────────────────────────────────────────────
//  SVG Icon set — all inline, no external dependency
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const icon =
  (path: string) =>
  ({ size = 16, className, style }: IconProps = {}) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d={path} />
    </svg>
  );

const multiPath =
  (paths: string[]) =>
  ({ size = 16, className, style }: IconProps = {}) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );

export const IconLayoutDashboard = multiPath([
  "M3 3h7v7H3z",
  "M14 3h7v7h-7z",
  "M3 14h7v7H3z",
  "M14 14h7v7h-7z",
]);
export const IconServer = multiPath([
  "M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
  "M2 15v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4",
  "M6 9h.01M6 15h.01",
]);
export const IconQueue = multiPath([
  "M3 6h18",
  "M3 12h18",
  "M3 18h11",
]);
export const IconBriefcase = multiPath([
  "M16 20H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z",
  "M12 2v4",
  "M8 6V4",
  "M16 6V4",
]);
export const IconChartLine = multiPath([
  "M3 20l6-8 5 4 5-8 2 2",
]);
export const IconAlertOctagon = icon("M12 2L2 7l10 17 10-17L12 2z M12 8v4 M12 16h.01");
export const IconSettings = multiPath([
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
]);
export const IconPlus = icon("M12 5v14M5 12h14");
export const IconX = icon("M18 6L6 18M6 6l12 12");
export const IconSearch = icon("M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z");
export const IconChevronRight = icon("M9 18l6-6-6-6");
export const IconChevronLeft  = icon("M15 18l-6-6 6-6");
export const IconChevronDown  = icon("M6 9l6 6 6-6");
export const IconRefresh = icon("M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15");
export const IconPause = multiPath(["M10 4H6v16h4z", "M18 4h-4v16h4z"]);
export const IconPlay  = icon("M5 3l14 9-14 9V3z");
export const IconTrash = multiPath([
  "M3 6h18",
  "M8 6V4h8v2",
  "M19 6l-1 14H6L5 6",
]);
export const IconLogOut = multiPath([
  "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
  "M16 17l5-5-5-5",
  "M21 12H9",
]);
export const IconClock = multiPath(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]);
export const IconCpu   = multiPath([
  "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",
]);
export const IconRepeat = multiPath([
  "M17 1l4 4-4 4",
  "M3 11V9a4 4 0 0 1 4-4h14",
  "M7 23l-4-4 4-4",
  "M21 13v2a4 4 0 0 1-4 4H3",
]);
export const IconBox    = multiPath([
  "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  "M3.27 6.96L12 12.01l8.73-5.05",
  "M12 22.08V12",
]);
export const IconActivity = icon("M22 12h-4l-3 9L9 3l-3 9H2");
export const IconBuilding = multiPath([
  "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18",
  "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
  "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
  "M10 6h4",
  "M10 10h4",
  "M10 14h4",
  "M10 18h4",
]);
export const IconFolder = multiPath([
  "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
]);

// Logo mark — abstract bolt/lightning
export const LogoMark = ({ size = 16 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M13 2L4.5 13.5H11L9 22 19.5 9.5H13.5L13 2Z" />
  </svg>
);
