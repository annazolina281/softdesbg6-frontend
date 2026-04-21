import { useState, useEffect, useCallback } from 'react'
import AppLayout from './AppLayout'
import { API } from './api'

const PERIODS = [
  { key: '1week',   label: '1 Week'   },
  { key: '1month',  label: '1 Month'  },
  { key: '6months', label: '6 Months' },
  { key: '1year',   label: '1 Year'   },
]

const SEV = { High: '#ef4444', Medium: '#f97316', Low: '#eab308' }
const SRC = { image: '#3b82f6', video: '#8b5cf6', webcam: '#10b981', dashcam: '#f59e0b' }

export default function Dashboard() {
  const [stats,    setStats]    = useState(null)
  const [history,  setHistory]  = useState(null)
  const [period,   setPeriod]   = useState('1month')
  const [loading,  setLoading]  = useState(true)
  const [hLoading, setHLoading] = useState(false)
  const [daily,    setDaily]    = useState(null)
  const [error,    setError]    = useState('')

  // Quick stats
  useEffect(() => {
    fetch(API('/api/stats/dashboard'))
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d) })
      .catch(() => setError('Backend not reachable — make sure App.py is running'))
      .finally(() => setLoading(false))

    // Today's daily report
    fetch(API('/api/reports/daily'))
      .then(r => r.json())
      .then(d => { if (d.success) setDaily(d) })
      .catch(() => {})
  }, [])

  // History by period
  const loadHistory = useCallback(() => {
    setHLoading(true)
    fetch(API(`/api/stats/history?period=${period}`))
      .then(r => r.json())
      .then(d => { if (d.success) setHistory(d) })
      .catch(() => setError('Could not load history'))
      .finally(() => setHLoading(false))
  }, [period])

  useEffect(() => { loadHistory() }, [loadHistory])

  const downloadDailyReport = () => {
    const today = new Date().toISOString().slice(0, 10)
    window.open(API(`/api/reports/daily/download?date=${today}`), '_blank')
  }

  // Bar chart
  const BarChart = ({ data }) => {
    if (!data || data.length === 0) return (
      <div style={{ color: '#6b7280', padding: 20, textAlign: 'center', fontSize: 13 }}>
        No detections in this period yet
      </div>
    )
    const max     = Math.max(...data.map(d => d.total), 1)
    const visible = data.slice(-30)
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, overflowX: 'auto' }}>
        {visible.map((d, i) => (
          <div key={i} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, height: Math.max(4, (d.total/max)*90), width: 16 }}>
              {['High','Medium','Low'].map(s => d[s] > 0 && (
                <div key={s} style={{ flex: d[s], background: SEV[s], borderRadius: '2px 2px 0 0', minHeight: 3 }} />
              ))}
            </div>
            {visible.length <= 14 && (
              <div style={{ fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap', transform: 'rotate(-45deg)', marginTop: 4 }}>
                {d.date?.slice(5)}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <AppLayout>
      <div style={{ color: '#e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Dashboard</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              Road pothole monitoring overview
            </p>
          </div>
          <button
            onClick={downloadDailyReport}
            style={{
              padding: '9px 18px', background: '#1f2937', color: '#9ca3af',
              border: '1px solid #374151', borderRadius: 7, cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Download Today's Report
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, color: '#f87171', marginBottom: 20, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Quick stats */}
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading stats...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Detections', value: stats?.total    ?? 0, color: '#3b82f6' },
                { label: 'Today',            value: stats?.today    ?? 0, color: '#10b981' },
                { label: 'This Week',        value: stats?.this_week?? 0, color: '#f59e0b' },
                { label: 'Critical (High)',  value: stats?.critical ?? 0, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ background: '#111827', borderRadius: 10, padding: 20, borderLeft: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Source breakdown */}
            {stats?.by_source && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
                {Object.entries(stats.by_source).map(([src, cnt]) => (
                  <div key={src} style={{ background: '#111827', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#9ca3af', textTransform: 'capitalize' }}>{src}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: SRC[src] || '#e5e7eb' }}>{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Today's report summary */}
        {daily && daily.total > 0 && (
          <div style={{ background: '#111827', borderRadius: 12, padding: 24, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Today's Report — {daily.date}</h3>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{daily.total} detections total</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {Object.entries(daily.severity_counts || {}).map(([sev, cnt]) => (
                <div key={sev} style={{ background: '#1f2937', borderRadius: 8, padding: 14, borderTop: `3px solid ${SEV[sev]}` }}>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{sev}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: SEV[sev] }}>{cnt}</div>
                </div>
              ))}
            </div>

            {/* Today's priority detections table */}
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              Top detections today (sorted by priority)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937' }}>
                    {['#','Time','Severity','Confidence','Barangay','Source'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(daily.detections || []).slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                      <td style={{ padding: '8px 10px', color: '#6b7280' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', color: '#9ca3af', fontSize: 12 }}>
                        {new Date(r.detected_at).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: SEV[r.severity] + '22', color: SEV[r.severity] }}>
                          {r.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#e5e7eb' }}>{r.confidence?.toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', color: '#e5e7eb' }}>{r.barangay || '—'}</td>
                      <td style={{ padding: '8px 10px', color: SRC[r.source] || '#9ca3af', textTransform: 'capitalize' }}>{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History */}
        <div style={{ background: '#111827', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Detection History</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: period === p.key ? '#3b82f6' : '#1f2937',
                  color:      period === p.key ? '#fff'    : '#9ca3af',
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {hLoading ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading...</div>
          ) : history ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                {Object.entries(history.severity_totals || {}).map(([sev, cnt]) => (
                  <div key={sev} style={{ background: '#1f2937', borderRadius: 8, padding: 14, borderTop: `3px solid ${SEV[sev]}` }}>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{sev} Severity</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: SEV[sev] }}>{cnt}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Potholes per day</div>
                <BarChart data={history.daily_chart} />
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {Object.entries(SEV).map(([s, c]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9ca3af' }}>
                      <div style={{ width: 10, height: 10, background: c, borderRadius: 2 }} /> {s}
                    </div>
                  ))}
                </div>
              </div>

              {Object.keys(history.by_barangay || {}).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>By Barangay</div>
                  {Object.entries(history.by_barangay).sort((a,b) => b[1]-a[1]).slice(0,8).map(([brgy, cnt]) => {
                    const max = Math.max(...Object.values(history.by_barangay))
                    return (
                      <div key={brgy} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 150, fontSize: 12, color: '#9ca3af', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brgy}</div>
                        <div style={{ flex: 1, background: '#1f2937', borderRadius: 4, height: 14 }}>
                          <div style={{ height: '100%', borderRadius: 4, background: '#3b82f6', width: `${(cnt/max)*100}%` }} />
                        </div>
                        <div style={{ width: 30, fontSize: 12, color: '#e5e7eb', textAlign: 'right' }}>{cnt}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Recent Detections</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937' }}>
                    {['Time','Barangay','Severity','Confidence','Source'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(history.recent || []).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                      <td style={{ padding: '8px 10px', color: '#9ca3af' }}>{new Date(r.detected_at).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', color: '#e5e7eb' }}>{r.barangay || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: SEV[r.severity]+'22', color: SEV[r.severity] }}>{r.severity}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#e5e7eb' }}>{r.confidence?.toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', color: SRC[r.source]||'#9ca3af', textTransform: 'capitalize' }}>{r.source}</td>
                    </tr>
                  ))}
                  {(!history.recent || history.recent.length === 0) && (
                    <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>No detections in this period</td></tr>
                  )}
                </tbody>
              </table>

              <div style={{ marginTop: 12, fontSize: 11, color: '#4b5563' }}>
                Showing from {new Date(history.since).toLocaleDateString()} — {history.total} total
              </div>
            </>
          ) : (
            <div style={{ color: '#6b7280', fontSize: 13 }}>No data yet — start detecting potholes to see history here</div>
          )}
        </div>
      </div>

    </AppLayout>
  )
}