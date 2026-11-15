import Link from "next/link";
import { hu } from "../lib/i18n/hu";
export default function NotFound() { return <main className="auth-page"><section className="auth-card"><span className="eyebrow">404 · DetailFlow</span><h1>{hu.errors.notFound}</h1><Link className="button primary" href="/">{hu.errors.back}</Link></section></main>; }
