import { Link } from 'react-router-dom';
import { money } from '../../format';

const Bar = ({ label, value, max }) => (
  <div className="bar-row">
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    <span className="bar-track">
      <span className="bar-fill" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
    <span className="n">{value}</span>
  </div>
);

/** Click analytics. Clicks are the only signal we have — commissions live in the store dashboards. */
export default function Analytics({ stats }) {
  if (!stats) return <div className="skeleton" style={{ height: 260 }} />;

  const maxStore = Math.max(1, ...stats.byStore.map((s) => s.clicks));
  const maxCategory = Math.max(1, ...stats.byCategory.map((c) => c.clicks));
  const maxDay = Math.max(1, ...stats.clicksPerDay.map((d) => d.clicks));

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Clicks today</div>
          <div className="value">{stats.clicks.today}</div>
        </div>
        <div className="stat-card">
          <div className="label">Last 7 days</div>
          <div className="value">{stats.clicks.last7}</div>
        </div>
        <div className="stat-card">
          <div className="label">Last 30 days</div>
          <div className="value">{stats.clicks.last30}</div>
        </div>
        <div className="stat-card">
          <div className="label">All time</div>
          <div className="value">{stats.totals.clicks}</div>
        </div>
      </div>

      <div className="card">
        <h2>Clicks by store</h2>
        <div className="bar-chart">
          {stats.byStore.map((s) => (
            <Bar key={s.store} label={`${s.store} (${s.deals} deals)`} value={s.clicks} max={maxStore} />
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Clicks by category</h2>
        <div className="bar-chart">
          {stats.byCategory.map((c) => (
            <Bar key={c.category} label={c.category} value={c.clicks} max={maxCategory} />
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Last 14 days</h2>
        {stats.clicksPerDay.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No clicks recorded yet.
          </p>
        ) : (
          <div className="bar-chart">
            {stats.clicksPerDay.map((d) => (
              <Bar key={d.day} label={d.day} value={d.clicks} max={maxDay} />
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Top earning deals</h2>
        {stats.topDeals.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing clicked yet. Share a deal page and check back.
          </p>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Deal</th>
                  <th>Store</th>
                  <th>Price</th>
                  <th>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {stats.topDeals.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-title">
                      <Link to={`/deal/${d.slug}`}>{d.title}</Link>
                    </td>
                    <td>
                      <span className={`pill pill-${d.store}`}>{d.store}</span>
                    </td>
                    <td>{money(d.price)}</td>
                    <td style={{ fontWeight: 700 }}>{d.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
