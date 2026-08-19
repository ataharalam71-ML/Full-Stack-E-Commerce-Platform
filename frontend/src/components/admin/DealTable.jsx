import { useState } from 'react';
import api, { errMsg } from '../../api';
import { money, shortDate } from '../../format';

/**
 * The list side of the admin panel: hide/show, edit, delete one, or tick several and
 * delete them together.
 */
export default function DealTable({ deals, loading, selected, setSelected, onEdit, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const toggle = async (deal, field) => {
    setError('');
    setBusyId(deal.id);
    try {
      await api.patch(`/admin/deals/${deal.id}/toggle`, { field });
      onChanged();
    } catch (err) {
      setError(errMsg(err, 'Could not update the deal'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (deal) => {
    // Deleting is permanent, so make the admin confirm the exact item.
    if (!window.confirm(`Delete "${deal.title}" permanently?\n\nThis also removes its click history.`)) {
      return;
    }
    setError('');
    setBusyId(deal.id);
    try {
      await api.delete(`/admin/deals/${deal.id}`);
      setSelected((prev) => prev.filter((id) => id !== deal.id));
      onChanged();
    } catch (err) {
      setError(errMsg(err, 'Could not delete the deal'));
    } finally {
      setBusyId(null);
    }
  };

  const allSelected = deals.length > 0 && deals.every((d) => selected.includes(d.id));
  const toggleAll = () =>
    setSelected(allSelected ? [] : Array.from(new Set([...selected, ...deals.map((d) => d.id)])));

  const toggleOne = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (loading) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="skeleton" style={{ height: 56 }} key={i} />
        ))}
      </div>
    );
  }

  if (!deals.length) {
    return (
      <div className="empty-state">
        <div className="big">📦</div>
        <h3>No deals here</h3>
        <p>Add one with the form, or clear the filters above.</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="error-box">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all deals on this page"
                />
              </th>
              <th style={{ width: 56 }}>Image</th>
              <th>Deal</th>
              <th>Store</th>
              <th>Price</th>
              <th>Clicks</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} style={{ opacity: busyId === deal.id ? 0.55 : 1 }}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(deal.id)}
                    onChange={() => toggleOne(deal.id)}
                    aria-label={`Select ${deal.title}`}
                  />
                </td>
                <td>
                  {deal.image_url ? (
                    <img className="thumb-xs" src={deal.image_url} alt="" loading="lazy" />
                  ) : (
                    <div className="thumb-xs" />
                  )}
                </td>
                <td>
                  <div className="cell-title">{deal.title}</div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    {deal.category}
                    {deal.brand ? ` · ${deal.brand}` : ''} ·{' '}
                    <a href={deal.tagged_url} target="_blank" rel="noreferrer nofollow">
                      test link ↗
                    </a>
                  </div>
                </td>
                <td>
                  <span className={`pill pill-${deal.store}`}>{deal.store}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{money(deal.price)}</div>
                  {deal.mrp > deal.price && <div className="mrp">{money(deal.mrp)}</div>}
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{deal.clicks}</td>
                <td>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className={`pill ${deal.is_active ? 'pill-live' : 'pill-hidden'}`}>
                      {deal.is_active ? 'Live' : 'Hidden'}
                    </span>
                    {deal.is_featured && <span className="pill pill-featured">Featured</span>}
                  </div>
                </td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                  {shortDate(deal.created_at)}
                </td>
                <td className="actions">
                  <button className="btn btn-sm" onClick={() => onEdit(deal)} disabled={busyId === deal.id}>
                    Edit
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => toggle(deal, 'is_active')}
                    disabled={busyId === deal.id}
                  >
                    {deal.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => toggle(deal, 'is_featured')}
                    disabled={busyId === deal.id}
                    title="Show or remove from Today's top picks"
                  >
                    {deal.is_featured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => remove(deal)}
                    disabled={busyId === deal.id}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
