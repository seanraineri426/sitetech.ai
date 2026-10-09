'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface AppShellProps {
  children: React.ReactNode;
  currentPath: string;
}

const navItems = [
  { label: 'Command center', path: '/command-center' },
  { label: 'Projects', path: '/projects' },
  { label: 'Actions', path: '/actions' },
  { label: 'Ask', path: '/ask' },
  { label: 'Settings', path: '/settings' },
];

export function AppShell({ children, currentPath }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 h-16 px-6 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect width="20" height="20" rx="4" fill="currentColor" className="text-primary-foreground" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">SiteTech</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button className="flex items-center gap-2 text-sm text-sidebar-foreground hover:text-sidebar-accent-foreground min-h-[44px]">
            <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
              <path
                d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 2.5v1.25M8 12.25V13.5M13.5 8h-1.25M4.75 8H3.5M11.75 11.75l-.884-.884M5.134 5.134l-.884-.884M11.75 4.25l-.884.884M5.134 10.866l-.884.884"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Settings
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-accent min-h-[44px] min-w-[44px]"
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <select
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium border border-border focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
              defaultValue="all"
            >
              <option value="all">All projects</option>
            </select>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Checked 5:12am
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              JM
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center gap-3 h-16 px-6 border-b border-sidebar-border">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect
                    width="20"
                    height="20"
                    rx="4"
                    fill="currentColor"
                    className="text-primary-foreground"
                  />
                </svg>
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground">
                SiteTech
              </span>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
