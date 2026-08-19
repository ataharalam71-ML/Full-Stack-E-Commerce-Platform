import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';

const FIELDS = [
  { key: 'site_name', label: 'Site name', hint: 'Shown in the header, footer and browser tab.' },
  { key: 'site_tagline', label: 'Tagline', hint: 'The headline on the homepage banner.' },
  { key: 'contact_email', label: 'Contact email', hint: 'Published on the Contact page.' },
  {
    key: 'amazon_tag',
    label: 'Amazon Associates tag',
    hint: 'Looks like yourname-21. Get it at affiliate-program.amazon.in → your tracking IDs.',
  },
  {
    key: 'flipkart_affid',
    label: 'Flipkart affiliate ID',
    hint: 'From affiliate.flipkart.com → Account. Added to Flipkart links as affid.',
  },
  {
    key: 'meesho_tag',
    label: 'Meesho / network source ID',
    hint: 'Optional. Added as utm_source for your own reporting; Meesho tracking comes from the link itself.',
  },
];

/**
 * Affiliate IDs live in the database, not just .env, so they can be changed without a
 * redeploy. Every outgoing link picks the new value up immediately.
 */
export default function SettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/admin/settings')
      .then(({ data }) => setSettings(data.settings))
      .catch((err) => setError(errMsg(err, 'Could not load settings')));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    setSaving(true);
    try {
      await api.put('/admin/settings', { settings });
      setOkMsg('Saved. New links use these IDs straight away — reload to see name changes.');
    } catch (err) {
      setError(errMsg(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return error ? <div className="error-box">{error}</div> : <div className="skeleton" style={{ height: 300 }} />;
  }

  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 620 }}>
      <h2>Site &amp; affiliate settings</h2>

      {error && <div className="error-box">{error}</div>}
      {okMsg && <div className="success-box">{okMsg}</div>}

      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.key}>{f.label}</label>
          <input
            id={f.key}
            value={settings[f.key] ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))}
          />
          <p className="field-hint">{f.hint}</p>
        </div>
      ))}

      <button className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>

      <p className="field-hint" style={{ marginTop: 16 }}>
        Leave an ID blank while your affiliate application is pending — links still work, they just
        earn nothing until the ID is filled in.
      </p>
    </form>
  );
}
