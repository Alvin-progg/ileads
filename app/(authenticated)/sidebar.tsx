"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button.tsx";

export type IconKey =
  | "dashboard"
  | "learners"
  | "crla"
  | "rma"
  | "philiri"
  | "exams"
  | "teachers"
  | "reports"
  | "help";

export type NavItem = { label: string; href: string; icon: IconKey };

const ICONS: Record<IconKey, React.ReactNode> = {
  dashboard: (
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
  ),
  learners: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.3" />
      <path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" />
    </>
  ),
  crla: (
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" />
  ),
  rma: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8 7.5h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" strokeLinecap="round" />
    </>
  ),
  philiri: (
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.5 4.5V16H6.5A2.5 2.5 0 0 1 4 13.5z" />
  ),
  exams: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z" />
      <path d="m8.5 13 2 2 4-4.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  teachers: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <circle cx="9.5" cy="10.5" r="2" />
      <path d="M6.5 16c0-1.7 1.3-3 3-3s3 1.3 3 3" />
      <path d="M14.5 8h3M14.5 12h3M14.5 16h2" strokeLinecap="round" />
    </>
  ),
  reports: (
    <path d="M5 20V10M11 20V4M17 20v-7" strokeLinecap="round" />
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.4 2.2c-.9.4-1.3 1-1.3 1.9" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </>
  ),
};

function Icon({ name }: { name: IconKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-4">
      <div
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-[10px] bg-emerald-600 text-[12px] font-bold text-white"
      >
        IL
      </div>
      <span className="text-[15px] font-semibold">I-LEADS</span>
    </div>
  );
}

function NavLinks({
  navItems,
  isActive,
  onNavigate,
}: {
  navItems: NavItem[];
  isActive: (href: string) => boolean;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={
            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors " +
            (isActive(item.href)
              ? "bg-emerald-600 text-white"
              : "text-neutral-600 hover:bg-neutral-100")
          }
        >
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function BottomSection({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="shrink-0 space-y-1 border-t border-neutral-200 px-3 py-3">
      <Link
        href="/help"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100"
      >
        <Icon name="help" />
        Help / User Guide
      </Link>
      <div className="px-3 pt-1">
        <LogoutButton />
      </div>
    </div>
  );
}

export function Sidebar({
  navItems,
  fullName,
  role,
}: {
  navItems: NavItem[];
  fullName: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Mobile trigger — the shell's top bar reserves space for this via pl-10. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="no-print fixed top-3 left-3 z-40 grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm md:hidden"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Desktop sidebar — always visible, fixed width. */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
        <Brand />
        <NavLinks navItems={navItems} isActive={isActive} onNavigate={() => {}} />
        <BottomSection onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer. */}
      {open && (
        <div className="no-print fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="fade-up absolute top-0 left-0 flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="mr-3 grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="px-4 pb-2 text-[12px] text-neutral-500">
              {fullName} · {role}
            </p>
            <NavLinks navItems={navItems} isActive={isActive} onNavigate={() => setOpen(false)} />
            <BottomSection onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
