import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../app/chatgpt-auth";
import { getOwnerContext } from "./context";
import { readSettings } from "./business.ts";
import { ApplicationError } from "./errors.ts";
import type { Section } from "../lib/navigation";
import { hu } from "../lib/i18n/hu";
import { AppShell, Brand } from "../components/detailflow/shell";
import { Icon } from "../components/detailflow/icon";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { BusinessSettings } from "../lib/settings.ts";
import { navigation } from "../lib/navigation";

type RenderResult = { content: ReactNode; title?: string; description?: string };
type RenderContent = (context: Awaited<ReturnType<typeof getOwnerContext>>, settings: BusinessSettings) => Promise<RenderResult>;

export async function Application({ section, returnTo, render }: { section: Section; returnTo?: string; render?: RenderContent }) {
  const user = await getChatGPTUser();
  if (!user) return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><Brand/><strong>DetailFlow</strong></div><span className="eyebrow">{hu.app.tagline}</span><h1>{hu.auth.title}</h1><p>{hu.auth.body}</p><a className="button primary" href={chatGPTSignInPath(returnTo ?? navigation.find(item => item.key === section)!.path)} target="_top">{hu.auth.signIn}<Icon name="arrow" size={18}/></a><span className="auth-foot"><Icon name="shield" size={16}/>{hu.settings.privacyTitle}</span></div></div>;
  try {
    const context = await getOwnerContext();
    const { db, business } = context;
    const settings = await readSettings(db, business.id);
    const result = render ? await render(context, settings) : undefined;
    return <AppShell section={section} initialSettings={settings} user={{ displayName: user.displayName, email: user.email }} today={new Date().toISOString()} pageTitle={result?.title} pageDescription={result?.description}>{result?.content}</AppShell>;
  } catch (error) {
    if (error instanceof ApplicationError && error.status === 404) notFound();
    const forbidden = error instanceof ApplicationError && error.code === "forbidden";
    const setup = error instanceof ApplicationError && error.code === "setup";
    console.error("DetailFlow application unavailable", error instanceof Error ? error.name : "UnknownError");
    return <div className="auth-page"><div className="auth-card"><div className="auth-brand"><Brand/><strong>DetailFlow</strong></div><Icon name="shield" size={36}/><h1>{forbidden ? hu.auth.deniedTitle : hu.auth.setupTitle}</h1><p>{forbidden ? hu.auth.deniedBody : setup ? hu.auth.setupBody : hu.errors.unavailable}</p><div className="empty-actions"><a href="/" className="button primary">{hu.auth.retry}</a><a href={chatGPTSignOutPath()} target="_top" className="button secondary">{hu.app.signOut}</a></div></div></div>;
  }
}
