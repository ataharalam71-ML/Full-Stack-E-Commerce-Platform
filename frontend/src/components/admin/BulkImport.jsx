import { useState } from 'react';
import api, { errMsg } from '../../api';

const SAMPLE = `[
  {
    "title": "boAt Rockerz 255 Pro+ Bluetooth Neckband",
    "affiliate_url": "https://www.amazon.in/dp/B08TVJ2LSP",
    "price": 1299,
    "mrp": 2990,
    "category": "Audio",
    "brand": "boAt",
    "rating": 4.1,
    "image_url": "https://picsum.photos/seed/rockerz/600/600",
    "is_featured": true
  },
  {
    "title": "Wildcraft 44L Laptop Backpack",
    "affiliate_url": "https://www.flipkart.com/wildcraft-44-l-backpack/p/itm111222333",
    "price": 1099,
    "mrp": 2495,
    "category": "Bags"
  }
]`;

/** Paste a JSON array to add many deals in one go. Rows that fail are reported, not silently dropped. */
export default function BulkImport({ onImported }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  /**
   * Downloads every deal as JSON. Free hosts often wipe the disk on redeploy, so keeping a
   * backup you can paste back into the box above is the safety net.
   */
  const exportBackup = async () => {
    setError('');
    setExporting(true);
    try {
      const { data } = await api.get('/admin/deals/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'deals-backup.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errMsg(err, 'Could not export the catalogue'));
    } finally {
      setExporting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('That is not valid JSON. It must start with [ and end with ].');
      return;
    }
    if (!Array.isArray(parsed) || !parsed.length) {
      setError('Paste a JSON array of deals — see the example below.');
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post('/admin/deals/bulk', { deals: parsed });
      setResult(data);
      if (data.created > 0) {
        setText('');
        onImported?.();
      }
    } catch (err) {
      // A 400 with per-row errors is still useful output, so show it rather than just the message.
      if (err.response?.data?.errors) setResult(err.response.data);
      else setError(errMsg(err, 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Bulk import</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Add up to 200 deals at once. Only <code>title</code>, <code>affiliate_url</code> and{' '}
        <code>price</code> are required — the store is detected from the link.
      </p>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className={result.created ? 'success-box' : 'error-box'}>
          <strong>
            {result.created} deal{result.created === 1 ? '' : 's'} added
          </strong>
          {result.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {result.errors.map((e) => (
                <li key={e.row}>
                  Row {e.row} ({e.title}): {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={submit}>
        <label htmlFor="bulk">Deals JSON</label>
        <textarea
          id="bulk"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ minHeight: 220, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.82rem' }}
          placeholder={SAMPLE}
        />
        <div className="row">
          <button className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? 'Importing…' : 'Import deals'}
          </button>
          <button type="button" className="btn" onClick={() => setText(SAMPLE)}>
            Load example
          </button>
          <button type="button" className="btn" onClick={exportBackup} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export backup (JSON)'}
          </button>
        </div>
      </form>
    </div>
  );
}
