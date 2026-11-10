'use client';

import { useState, useEffect } from 'react';

const FIELDS = [
  { key: 'costPerMeeting', label: 'Cost / booked meeting', kind: 'money' },
  { key: 'costPerQualifiedMeeting', label: 'Cost / qualified meeting', kind: 'money' },
  { key: 'cpl', label: 'Cost / lead', kind: 'money' },
  { key: 'callQualifiedRate', label: 'Call-qualified rate', kind: 'percent' },
  { key: 'leadQualifiedRate', label: 'Lead-qualified rate', kind: 'percent' },
];

const blank = () => Object.fromEntries(FIELDS.map((f) => [f.key, '']));

/**
 * KPI targets for one client. Saved to the Settings tab of the Leads Tracker.
 * A blank field means "no target set" and that step of the verdict is skipped.
 */
export default function ClientSettings({ slug, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [currency, setCurrency] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/settings?client=${slug}&t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(json.error || 'Targets could not be loaded');
          return;
        }
        setLoadError(null);
        setCurrency(json.currency);
        setForm(
          Object.fromEntries(FIELDS.map((f) => [f.key, json.targets?.[f.key] ?? '']))
        );
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: slug, targets: form }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Keep what was typed. Never show "saved" on a failed write.
        setMessage({ ok: false, text: json.error || 'Save failed' });
        return;
      }
      setMessage({ ok: true, text: 'Saved' });
      onSaved?.();
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  const setCount = FIELDS.filter((f) => String(form[f.key]).trim() !== '').length;

  return (
    <div id="kpi-targets" className="glass-card p-4 mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">
          KPI targets{currency ? ` (${currency})` : ''}
        </span>
        <span className="text-xs" style={{ color: loadError ? 'var(--color-red)' : 'var(--color-text-muted)' }}>
          {loadError ? 'Targets unavailable' : `${setCount} of ${FIELDS.length} set`} {open ? '▲' : '▼'}
        </span>
      </button>

      {open && loadError && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-red)' }}>
          {loadError}. Targets cannot be edited until they load.
        </p>
      )}

      {open && !loadError && (
        <form onSubmit={save} className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span
                  className="block text-[10px] uppercase tracking-wider font-medium mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {f.label} {f.kind === 'percent' ? '(%)' : currency ? `(${currency})` : '($)'}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder="No target"
                  className="w-full px-2 py-1.5 text-sm rounded-lg"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium rounded-lg"
              style={{ background: 'var(--color-accent)', color: 'white', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save targets'}
            </button>
            {message && (
              <span
                className="text-xs"
                role="status"
                style={{ color: message.ok ? 'var(--color-green)' : 'var(--color-red)' }}
              >
                {message.text}
              </span>
            )}
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Leave a field blank to skip that check. An ad is flagged once it has spent the
            cost per qualified meeting target with no booked meeting. A campaign is flagged
            at twice that with no qualified meeting.
          </p>
        </form>
      )}
    </div>
  );
}
