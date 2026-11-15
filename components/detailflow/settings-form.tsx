"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "../../lib/i18n";
import { validateSettings } from "../../lib/settings.ts";
import type { BusinessSettings, SettingsErrors } from "../../lib/settings.ts";
import { Icon } from "./icon";

type NumericKey = "electricityPricePerKwh" | "waterPricePerCubicMeter" | "laborCostPerHour" | "equipmentReplacementMonths";
type Draft = Omit<BusinessSettings, NumericKey> & Record<NumericKey, string>;
function toDraft(value: BusinessSettings): Draft {
  return { ...value, electricityPricePerKwh: value.electricityPricePerKwh?.toString() ?? "", waterPricePerCubicMeter: value.waterPricePerCubicMeter?.toString() ?? "", laborCostPerHour: value.laborCostPerHour?.toString() ?? "", equipmentReplacementMonths: value.equipmentReplacementMonths.toString() };
}
function numberOrNull(value: string) { return value.trim() === "" ? null : Number(value.trim().replace(",", ".")); }

export function SettingsForm({ settings, dictionary: d, onSaved, onDirtyChange }: {
  settings: BusinessSettings; dictionary: Dictionary;
  onSaved: (value: BusinessSettings) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"" | "saved">("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ""; } }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    setMessage("");
  }
  function errorText(code?: string) { return code ? (d.errors[code as keyof typeof d.errors] ?? d.errors.invalidInput) : ""; }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateSettings({ ...draft,
      electricityPricePerKwh: numberOrNull(draft.electricityPricePerKwh),
      waterPricePerCubicMeter: numberOrNull(draft.waterPricePerCubicMeter),
      laborCostPerHour: numberOrNull(draft.laborCostPerHour),
      equipmentReplacementMonths: Number(draft.equipmentReplacementMonths),
    });
    if (!parsed.success) { setErrors(parsed.errors); return; }
    setSaving(true); setErrors({}); setMessage("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const body = await response.json();
      if (!response.ok) { setErrors({ ...(body.fields ?? {}), form: body.error ?? "unexpected" }); return; }
      const verified = validateSettings(body.settings);
      if (!verified.success) throw new Error("Invalid settings response");
      setDraft(toDraft(verified.data));
      onSaved(verified.data);
      setMessage("saved");
    } catch { setErrors({ form: "unexpected" }); }
    finally { setSaving(false); }
  }
  const costFields = [
    { key: "electricityPricePerKwh", label: d.settings.electricity, unit: "Ft / kWh" },
    { key: "waterPricePerCubicMeter", label: d.settings.water, unit: "Ft / m³" },
    { key: "laborCostPerHour", label: d.settings.labor, unit: "Ft / h" },
  ] as const;

  return <div className="settings-layout">
    <form onSubmit={submit} noValidate className="settings-form">
      <fieldset disabled={saving} className="settings-fieldset">
        <section className="panel form-section" aria-labelledby="general-heading">
          <div className="section-heading"><span className="section-icon"><Icon name="settings" /></span><div><h2 id="general-heading">{d.settings.general}</h2><p>{d.settings.generalBody}</p></div></div>
          <div className="field"><label htmlFor="businessName">{d.settings.businessName}</label><input id="businessName" name="businessName" autoComplete="organization" maxLength={120} value={draft.businessName} onChange={(event) => change("businessName", event.target.value)} aria-invalid={Boolean(errors.businessName)} aria-describedby="businessName-help" /><p id="businessName-help" className={errors.businessName ? "field-error" : "field-hint"}>{errors.businessName ? errorText(errors.businessName) : d.settings.nameHint}</p></div>
          <div className="field-grid">
            <div className="field"><label htmlFor="locale">{d.settings.language}</label><select id="locale" name="locale" value={draft.locale} onChange={(event) => change("locale", event.target.value as BusinessSettings["locale"])}><option value="hu">Magyar</option><option value="en">English</option></select></div>
            <div className="field"><label htmlFor="theme">{d.settings.theme}</label><select id="theme" name="theme" value={draft.theme} onChange={(event) => change("theme", event.target.value as BusinessSettings["theme"])}><option value="system">{d.settings.system}</option><option value="light">{d.settings.light}</option><option value="dark">{d.settings.dark}</option></select></div>
          </div>
        </section>
        <section className="panel form-section" aria-labelledby="regional-heading">
          <div className="section-heading"><span className="section-icon"><Icon name="sun" /></span><div><h2 id="regional-heading">{d.settings.regional}</h2><p>{d.settings.regionalBody}</p></div></div>
          <dl className="regional-list"><div><dt>{d.settings.currency}</dt><dd>HUF · Ft</dd></div><div><dt>{d.settings.timezone}</dt><dd>Europe/Budapest</dd></div><div><dt>{d.settings.units}</dt><dd>{d.settings.metric}</dd></div></dl>
        </section>
        <section className="panel form-section" aria-labelledby="costs-heading">
          <div className="section-heading"><span className="section-icon"><Icon name="tool" /></span><div><h2 id="costs-heading">{d.settings.costs}</h2><p>{d.settings.costsBody}</p></div></div>
          <div className="field-grid">{costFields.map(({ key, label, unit }) => <div key={key} className="field"><label htmlFor={key}>{label}<span className="optional">{d.settings.optional}</span></label><div className="input-unit"><input id={key} name={key} inputMode="decimal" value={draft[key]} onChange={(event) => change(key, event.target.value)} placeholder={d.settings.unset} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined}/><span>{unit}</span></div>{errors[key] && <p className="field-error" id={`${key}-error`}>{errorText(errors[key])}</p>}</div>)}</div>
          <p className="field-hint tariff-hint">{d.settings.electricityHint}</p>
          <div className="field replacement-field"><label htmlFor="equipmentReplacementMonths">{d.settings.replacement}</label><div className="input-unit"><input id="equipmentReplacementMonths" name="equipmentReplacementMonths" inputMode="numeric" value={draft.equipmentReplacementMonths} onChange={(event) => change("equipmentReplacementMonths", event.target.value)} aria-invalid={Boolean(errors.equipmentReplacementMonths)} aria-describedby={errors.equipmentReplacementMonths ? "replacement-error" : undefined}/><span>{d.settings.months}</span></div>{errors.equipmentReplacementMonths && <p id="replacement-error" className="field-error">{errorText(errors.equipmentReplacementMonths)}</p>}</div>
        </section>
      </fieldset>
      {errors.form && <div className="notice error-notice" role="alert">{errorText(errors.form)}</div>}
      {message === "saved" && <div className="notice success-notice" role="status"><Icon name="check" size={18}/>{d.settings.saved}</div>}
      <div className="save-bar"><span className={dirty ? "save-status dirty" : "save-status"}><span className="status-dot"/>{dirty ? d.settings.unsaved : d.settings.unchanged}</span><div className="save-actions"><button type="button" className="button secondary" disabled={!dirty || saving} onClick={() => { setDraft(toDraft(settings)); setErrors({}); setMessage(""); }}>{d.settings.discard}</button><button className="button primary" type="submit" disabled={!dirty || saving}>{saving ? d.settings.saving : d.settings.save}<Icon name="check" size={17}/></button></div></div>
    </form>
    <aside className="settings-aside"><div className="privacy-card"><span className="privacy-icon"><Icon name="shield" size={25}/></span><h3>{d.settings.privacyTitle}</h3><p>{d.settings.privacyBody}</p><span className="private-tag"><span className="status-dot"/>DetailFlow</span></div></aside>
  </div>;
}
