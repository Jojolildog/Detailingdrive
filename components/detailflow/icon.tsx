import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  car: <><path d="m5 6-2 6v6h2m14 0h2v-6l-2-6H5zm-2 12H7m-4-6h18M7 18v3m10-3v3"/><path d="M7 15h.01M17 15h.01"/></>,
  clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h4"/></>,
  sparkles: <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3zm7-1v4m-2-2h4"/></>,
  flask: <><path d="M9 3h6m-5 0v7L4 19a1.3 1.3 0 0 0 1.1 2h13.8a1.3 1.3 0 0 0 1.1-2l-6-9V3M7 15h10"/></>,
  tool: <><path d="m14 6 4 4 3-3a6 6 0 0 1-7.5 7.5L6 22l-4-4 7.5-7.5A6 6 0 0 1 17 3l-3 3z"/></>,
  chart: <><path d="M4 3v18h18M9 16v-4m5 4V7m5 9v-6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m10 3-1 3-3 1-3-1-1 4 2 2v2l-2 2 2 4 3-1 2 1 1 3h4l1-3 2-1 3 1 2-4-2-2v-2l2-2-1-4-3 1-3-1-1-3h-4z" transform="translate(0 -1) scale(1 .95)"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  shield: <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4z"/><path d="m8 12 3 3 5-6"/></>,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-5-5h10"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
};
export function Icon({ name, size = 20, className = "", style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.sparkles}</svg>;
}
