import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../app/chatgpt-auth";
import { getOwnerContext } from "./context";
import { readSettings } from "./business.ts";
import { ApplicationError } from "./errors.ts";
import type { Section } from "../lib/navigation";
import { hu } from "../lib/i18n/hu";
import { AppShell, Brand } from "../components/detailflow/shell";
import { Icon } from "../components/detailflow/icon";

export async function Application({ section }: { section: Section }) {
  const user = await getChatGPTUser();
  if (!user) return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><Brand/><strong>DetailFlow</strong></div><span className="eyebrow">{hu.app.tagline}</span><h1>{hu.auth.title}</h1><p>{hu.auth.body}</p><a className="button primary" href={chatGPTSignInPath(section === "dashboard" ? "/" : section === "workOrders" ? "/work-orders" : `/${section}`)} target="_top">{hu.auth.signIn}<Icon name="arrow" size={18}/></a><span className="auth-foot"><Icon name="shield" size={16}/>{hu.settings.privacyTitle}</span></div></div>;
  try {
    const { db, business } = await getOwnerContext();
    const settings = await readSettings(db, business.id);
    return <AppShell section={section} initialSettings={settings} user={{ displayName: user.displayName, email: user.email }} today={new Date().toISOString()}/>;
  } catch (error) {
    const forbidden = error instanceof ApplicationError && error.code === "forbidden";
    const setup = error instanceof ApplicationError && error.code === "setup";
    console.error("DetailFlow application unavailable", error instanceof Error ? error.name : "UnknownError");
    return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><Brand/><strong>DetailFlow</strong></div><Icon name="shield" size={36}/><h1>{forbidden ? hu.auth.deniedTitle : hu.auth.setupTitle}</h1><p>{forbidden ? hu.auth.deniedBody : setup ? hu.auth.setupBody : hu.errors.unavailable}</p><div className="empty-actions"><a href="/" className="button primary">{hu.auth.retry}</a><a href={chatGPTSignOutPath()} target="_top" className="button secondary">{hu.app.signOut}</a></div></div></div>;
  }
}
