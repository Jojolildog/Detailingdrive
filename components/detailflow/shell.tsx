"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDictionary, formatDate } from "../../lib/i18n";
import type { Dictionary } from "../../lib/i18n";
import { navigation } from "../../lib/navigation";
import type { Section } from "../../lib/navigation";
import type { BusinessSettings } from "../../lib/settings.ts";
import { Icon } from "./icon";
import { SettingsForm } from "./settings-form";
import { UnsavedChangesContext } from "./unsaved-changes";

export function Brand() { return <span className="brand-mark" aria-hidden="true"><svg width="24" height="28" viewBox="0 0 24 28" fill="none"><path d="M4 3h6c7 0 11 4 11 11s-4 11-11 11H4V3Z" stroke="currentColor" strokeWidth="3"/><path d="M4 10h9M4 17h6" stroke="currentColor" strokeWidth="2.5"/></svg></span>; }

function WorkshopIllustration() { return <svg className="workshop-art" viewBox="0 0 360 240" fill="none" aria-hidden="true"><path d="M35 210h290M64 202V63l116-38 116 38v139M74 89h212M74 101h212M74 113h212M74 125h212" stroke="currentColor" strokeOpacity=".16" strokeWidth="1.5"/><path d="M90 185v-27l13-29h151l15 29v27M90 158h179M109 185h141" stroke="currentColor" strokeWidth="2"/><path d="M109 129l10-16h120l15 16M105 185v16h22v-16m106 0v16h22v-16M107 170h21m104 0h20" stroke="currentColor" strokeWidth="2"/><path d="M292 99l5-16 5 16 16 5-16 5-5 16-5-16-16-5 16-5Z" fill="currentColor"/><path d="M71 48v18M62 57h18M256 37v12m-6-6h12" stroke="currentColor" strokeOpacity=".5" strokeWidth="2"/><circle cx="179" cy="68" r="9" stroke="currentColor" strokeOpacity=".3"/><path d="M176 68h6m-3-3v6" stroke="currentColor" strokeOpacity=".4"/></svg>; }

function Dashboard({ d, settings }: { d: Dictionary; settings: BusinessSettings }) {
  const steps = [
    { number: "01", icon: "settings", title: d.dashboard.first, body: d.dashboard.firstBody, status: d.dashboard.available, active: true },
    { number: "02", icon: "users", title: d.dashboard.second, body: d.dashboard.secondBody, status: d.dashboard.available, active: true },
    { number: "03", icon: "chart", title: d.dashboard.third, body: d.dashboard.thirdBody, status: d.dashboard.later, active: false },
  ];
  return <div className="dashboard-grid">
    <section className="welcome-card"><div className="welcome-copy"><span className="light-badge"><span className="status-dot"/>{d.dashboard.ready}</span><h2>{d.dashboard.welcomeTitle}</h2><p>{d.dashboard.welcomeBody}</p><Link href="/settings" className="button cream">{d.dashboard.configure}<Icon name="arrow" size={18}/></Link></div><WorkshopIllustration/><span className="welcome-foot">DETAILFLOW <span> / </span> {d.dashboard.foundation}</span></section>
    <section className="panel getting-started"><div className="panel-heading"><h2>{d.dashboard.setup}</h2><span className="tiny-label">{d.app.phase}</span></div><ol className="setup-list">{steps.map((step) => <li key={step.number} className={step.active ? "setup-item active" : "setup-item"}><span className="step-number">{step.number === "01" && settings.businessName ? <Icon name="check" size={18}/> : step.number}</span><div><div className="step-title-row"><h3>{step.title}</h3><span className={step.active ? "step-badge ready" : "step-badge"}>{step.status}</span></div><p>{step.body}</p></div></li>)}</ol><Link href="/settings" className="setup-link"><span className="status-dot"/>{settings.businessName ? d.dashboard.setupDone : d.dashboard.setupPending}<Icon name="chevron" size={15}/></Link></section>
    <section className="panel activity-panel"><div className="panel-heading"><h2>{d.dashboard.emptyTitle}</h2><Icon name="clipboard" size={19}/></div><div className="activity-empty"><span className="empty-symbol"><Icon name="clipboard" size={28}/></span><p>{d.dashboard.emptyBody}</p><div className="empty-lines" aria-hidden="true"><span/><span/><span/></div></div></section>
    <section className="data-card"><span className="data-icon"><Icon name="chart" size={24}/></span><h2>{d.dashboard.dataTitle}</h2><p>{d.dashboard.dataBody}</p><div className="data-card-footer"><Icon name="shield" size={17}/><span>{d.app.workspace}</span></div></section>
  </div>;
}

function EmptyModule({ section, d }: { section: Exclude<Section, "dashboard" | "settings">; d: Dictionary }) {
  const entry = navigation.find((item) => item.key === section)!;
  return <section className="panel module-empty"><span className="module-icon"><Icon name={entry.icon} size={34}/></span><span className="eyebrow">{d.empty.label}</span><h2>{d.empty[section]}</h2><p>{d.empty.body}</p><div className="empty-actions"><Link href="/" className="button primary">{d.empty.back}<Icon name="arrow" size={17}/></Link><Link href="/settings" className="button secondary">{d.empty.settings}</Link></div><span className="empty-note">{d.empty.noData}</span></section>;
}

export function AppShell({ section, initialSettings, user, today, children, pageTitle, pageDescription }: {
  section: Section; initialSettings: BusinessSettings;
  user: { displayName: string; email: string }; today: string;
  children?: React.ReactNode; pageTitle?: string; pageDescription?: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);
  const d = getDictionary(settings.locale);

  useEffect(() => {
    document.documentElement.lang = settings.locale;
    document.documentElement.dataset.theme = settings.theme;
    document.title = `${d.nav[section]} · DetailFlow`;
  }, [settings.locale, settings.theme, section, d]);
  useEffect(() => { setSettings(initialSettings); }, [initialSettings]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter((node) => node.getClientRects().length > 0);
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    }
    function onResize() { if (window.matchMedia("(min-width: 1024px)").matches) setMobileOpen(false); }
    window.addEventListener("keydown", onKey); window.addEventListener("resize", onResize);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); menuButton.current?.focus(); };
  }, [mobileOpen]);

  function onNavigate(event: React.MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm(d.settings.leave)) { event.preventDefault(); return; }
    setMobileOpen(false);
  }
  const current = navigation.find((item) => item.key === section)!;
  return <div className="application">
    <a href="#main-content" className="skip-link">{d.app.skip}</a>
    {mobileOpen && <button className="nav-overlay" aria-label={d.app.close} tabIndex={-1} onClick={() => setMobileOpen(false)}/>}
    <aside id="app-sidebar" className={mobileOpen ? "sidebar is-open" : "sidebar"} ref={sidebar} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined} aria-label={d.app.navigation}>
      <div className="sidebar-brand"><Link href="/" className="brand" onClick={onNavigate}><Brand/><span>Detail<span className="brand-flow">Flow</span><small>{d.app.tagline}</small></span></Link><button className="icon-button mobile-close" aria-label={d.app.close} onClick={() => setMobileOpen(false)}><Icon name="close"/></button></div>
      <div className="workspace-label"><span className="workspace-avatar">{settings.businessName ? settings.businessName.charAt(0).toLocaleUpperCase(settings.locale) : <Icon name="sparkles" size={18}/>}</span><div><strong>{settings.businessName || d.app.workspace}</strong><span>DetailFlow</span></div><Icon name="shield" size={15}/></div>
      <nav aria-label={d.app.navigation}><span className="nav-label">{settings.locale === "hu" ? "MUNKATERÜLET" : "WORKSPACE"}</span>{navigation.filter((item) => item.key !== "settings").map((entry) => <Link key={entry.key} href={entry.path} className={section === entry.key ? "nav-link active" : "nav-link"} aria-current={section === entry.key ? "page" : undefined} onClick={onNavigate}><Icon name={entry.icon}/><span>{d.nav[entry.key]}</span>{section === entry.key && <span className="nav-current-dot"/>}</Link>)}<div className="nav-divider"/><Link href="/settings" className={section === "settings" ? "nav-link active" : "nav-link"} aria-current={section === "settings" ? "page" : undefined} onClick={onNavigate}><Icon name="settings"/><span>{d.nav.settings}</span></Link></nav>
      <div className="sidebar-bottom"><div className="phase-indicator"><span className="status-dot"/>{d.app.phase}</div><div className="account"><span className="account-avatar">{user.displayName.charAt(0).toLocaleUpperCase(settings.locale)}</span><div><strong>{user.displayName}</strong><span>{d.app.signedIn}</span></div><a href="/signout-with-chatgpt?return_to=%2F" target="_top" className="icon-button" aria-label={d.app.signOut} title={d.app.signOut} onClick={onNavigate}><Icon name="logout" size={19}/></a></div></div>
    </aside>
    <div className="app-body" inert={mobileOpen}>
      <header className="topbar"><div className="breadcrumb"><button ref={menuButton} className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="app-sidebar" aria-label={d.app.menu}><Icon name="menu"/></button><span className="breadcrumb-home">DetailFlow</span><span className="breadcrumb-slash">/</span><strong>{d.nav[section]}</strong></div><div className="topbar-right"><span className="date-label">{formatDate(new Date(today), settings.locale)}</span><span className="topbar-divider"/><span className="locale-label">{settings.locale.toUpperCase()}</span><span className="header-avatar" title={user.email}>{user.displayName.charAt(0).toLocaleUpperCase(settings.locale)}</span></div></header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">{section === "dashboard" ? d.dashboard.eyebrow : section === "settings" ? d.settings.eyebrow : section === "customers" ? d.customers.eyebrow : section === "vehicles" ? d.vehicles.eyebrow : d.empty.label}</p><h1>{pageTitle ?? (section === "dashboard" ? d.dashboard.title : d.nav[section])}</h1><p className="page-description">{pageDescription ?? (section === "dashboard" ? d.dashboard.description : section === "settings" ? d.settings.description : section === "customers" ? d.customers.description : section === "vehicles" ? d.vehicles.description : d.empty[section])}</p></div><span className="page-icon"><Icon name={current.icon} size={25}/></span></div>
        <UnsavedChangesContext.Provider value={onDirtyChange}>{children ?? (section === "dashboard" ? <Dashboard d={d} settings={settings}/> : section === "settings" ? <SettingsForm settings={settings} dictionary={d} onSaved={setSettings} onDirtyChange={onDirtyChange}/> : <EmptyModule section={section} d={d}/>)}</UnsavedChangesContext.Provider>
        <footer className="app-footer"><span>DetailFlow</span><span>{d.app.phase}</span></footer>
      </main>
    </div>
  </div>;
}
