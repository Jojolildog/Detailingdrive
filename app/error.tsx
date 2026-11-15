"use client";
import { hu } from "../lib/i18n/hu";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-page"><section className="auth-card" role="alert"><h1>{hu.errors.load}</h1><p>{hu.errors.unavailable}</p><button className="button primary" onClick={reset}>{hu.auth.retry}</button></section></main>;
}
