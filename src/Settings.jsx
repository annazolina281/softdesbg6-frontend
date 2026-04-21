import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import AppLayout from './AppLayout'
import { API } from './api'

const PERIODS = [
  { key: '1week',   label: '1 Week' },
  { key: '1month',  label: '1 Month' },
  { key: '6months', label: '6 Months' },
  { key: '1year',   label: '1 Year' },
]

export default function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('account')

  // Account state
  const [name, setName]             = useState(localStorage.getItem('user_name') || 'Admin User')
  const [email, setEmail]           = useState(localStorage.getItem('user_email') || 'admin@example.com')
  const [saved, setSaved]           = useState(false)

  // Barangay alert state
  const [barangays, setBarangays]   = useState([])
  const [brgyLoading, setBrgyLoading] = useState(false)
  const [newBrgy, setNewBrgy]       = useState({ barangay_name: '', recipient_email: '', alert_threshold: 5 })
  const [addMsg, setAddMsg]         = useState('')

  // Alert send state
  const [selectedBrgy, setSelectedBrgy] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('1week')
  const [sendLoading, setSendLoading]   = useState(false)
  const [sendResult, setSendResult]     = useState(null)

  // Alert history
  const [alertHistory, setAlertHistory] = useState([])

  // Storage status
  const [storageStatus, setStorageStatus] = useState(null)

  // Load barangays
  const loadBarangays = () => {
    setBrgyLoading(true)
    fetch(API('/api/barangays'))
      .then(r => r.json())
      .then(d => { if (d.success) setBarangays(d.barangays) })
      .catch(() => {})
      .finally(() => setBrgyLoading(false))
  }

  // Load alert history
  const loadAlertHistory = () => {
    fetch(API('/api/alerts/history'))
      .then(r => r.json())
      .then(d => { if (d.success) setAlertHistory(d.history) })
      .catch(() => {})
  }

  // Load storage status
  const loadStorage = () => {
    fetch(API('/api/storage/status'))
      .then(r => r.json())
      .then(d => { if (d.success) setStorageStatus(d) })
      .catch(() => {})
  }

  useEffect(() => {
    loadBarangays()
    loadAlertHistory()
    loadStorage()
  }, [])

  // Save account
  const handleSaveAccount = () => {
    localStorage.setItem('user_name', name)
    localStorage.setItem('user_email', email)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Add barangay
  const handleAddBrgy = async () => {
    if (!newBrgy.barangay_name || !newBrgy.recipient_email) {
      setAddMsg('Barangay name and email are required.')
      return
    }
    try {
      const res  = await fetch(API('/api/barangays'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrgy)
      })
      const data = await res.json()
      if (data.success) {
        setAddMsg('Barangay saved.')
        setNewBrgy({ barangay_name: '', recipient_email: '', alert_threshold: 5 })
        loadBarangays()
      } else {
        setAddMsg(data.error || 'Failed to save.')
      }
    } catch {
      setAddMsg('Network error.')
    }
    setTimeout(() => setAddMsg(''), 3000)
  }

  // Send / download CSV alert
  const handleSendAlert = async (downloadOnly = false) => {
    if (!selectedBrgy) { setSendResult({ error: 'Please select a barangay.' }); return }
    setSendLoading(true)
    setSendResult(null)

    if (downloadOnly) {
      // Direct CSV download
      try {
        const res = await fetch(API('/api/alerts/download-csv'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barangay: selectedBrgy, period: selectedPeriod })
        })
        if (res.ok) {
          const blob = await res.blob()
          const url  = URL.createObjectURL(blob)
          const a    = document.createElement('a')
          a.href     = url
          a.download = `pothole_${selectedBrgy.replace(/ /g, '_')}_${selectedPeriod}.csv`
          a.click()
          URL.revokeObjectURL(url)
          setSendResult({ ok: 'CSV downloaded.' })
        } else {
          setSendResult({ error: 'Download failed.' })
        }
      } catch (e) {
        setSendResult({ error: String(e) })
      }
      setSendLoading(false)
      return
    }

    try {
      const res  = await fetch(API('/api/alerts/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barangay:   selectedBrgy,
          period:     selectedPeriod,
          send_email: true
        })
      })
      const data = await res.json()
      setSendResult(data)
      if (data.success) loadAlertHistory()
    } catch (e) {
      setSendResult({ error: String(e) })
    }
    setSendLoading(false)
  }

  const tabStyle = (t) => ({
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    background: activeTab === t ? '#3b82f6' : '#1f2937',
    color:      activeTab === t ? '#fff'    : '#9ca3af',
  })

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '14px',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '6px',
    display: 'block'
  }

  return (
    <AppLayout>
      <div style={{ padding: '24px', color: '#e5e7eb', maxWidth: '860px' }}>
        <h2 style={{ margin: 0, marginBottom: '24px', fontSize: '20px', fontWeight: 700 }}>Settings</h2>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
          {[
            { key: 'account',  label: 'Account' },
            { key: 'alerts',   label: 'Barangay Alerts' },
            { key: 'storage',  label: 'Storage Status' },
          ].map(t => (
            <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ACCOUNT TAB ── */}
        {activeTab === 'account' && (
          <div style={{ background: '#111827', borderRadius: '12px', padding: '28px' }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 600 }}>Account Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} value={name}  onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleSaveAccount}
                  style={{
                    padding: '10px 24px', background: '#3b82f6', color: '#fff',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '14px'
                  }}
                >
                  {saved ? 'Saved!' : 'Save Changes'}
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '10px 24px', background: '#7f1d1d', color: '#fca5a5',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '14px'
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ── */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Send Alert */}
            <div style={{ background: '#111827', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px', fontWeight: 600 }}>Send Alert Report</h3>
              <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: 0, marginBottom: '20px' }}>
                Generate a CSV report of pothole detections for a barangay and optionally email it to the configured recipient.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Barangay</label>
                  <select
                    style={{ ...inputStyle }}
                    value={selectedBrgy}
                    onChange={e => setSelectedBrgy(e.target.value)}
                  >
                    <option value="">— All Barangays —</option>
                    {barangays.map(b => (
                      <option key={b.barangay_name} value={b.barangay_name}>{b.barangay_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Period</label>
                  <select
                    style={{ ...inputStyle }}
                    value={selectedPeriod}
                    onChange={e => setSelectedPeriod(e.target.value)}
                  >
                    {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => handleSendAlert(false)}
                  disabled={sendLoading}
                  style={{
                    padding: '10px 22px', background: '#10b981', color: '#fff',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '14px'
                  }}
                >
                  {sendLoading ? 'Sending...' : 'Send via Email'}
                </button>
                <button
                  onClick={() => handleSendAlert(true)}
                  disabled={sendLoading}
                  style={{
                    padding: '10px 22px', background: '#1f2937', color: '#9ca3af',
                    border: '1px solid #374151', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '14px'
                  }}
                >
                  Download CSV
                </button>
              </div>

              {sendResult && (
                <div style={{
                  marginTop: '16px', padding: '12px', borderRadius: '8px',
                  background: sendResult.error ? '#7f1d1d' : '#064e3b',
                  color:      sendResult.error ? '#fca5a5' : '#6ee7b7',
                  fontSize: '13px'
                }}>
                  {sendResult.error ? (
                    `Error: ${sendResult.error}`
                  ) : (
                    <>
                      Report generated: <strong>{sendResult.records}</strong> records —
                      Email: <strong>{sendResult.email_status}</strong>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Barangay list */}
            <div style={{ background: '#111827', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontWeight: 600 }}>Configured Barangays</h3>
              {brgyLoading ? (
                <div style={{ color: '#9ca3af' }}>Loading...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1f2937' }}>
                        {['Barangay', 'Recipient Email', 'Threshold', 'Active', 'Last Alert'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {barangays.map((b, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                          <td style={{ padding: '10px', color: '#e5e7eb' }}>{b.barangay_name}</td>
                          <td style={{ padding: '10px', color: '#9ca3af' }}>{b.recipient_email}</td>
                          <td style={{ padding: '10px', color: '#9ca3af' }}>{b.alert_threshold}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                              background: b.is_active ? '#064e3b' : '#3b0a0a',
                              color:      b.is_active ? '#6ee7b7' : '#fca5a5'
                            }}>
                              {b.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#6b7280', fontSize: '12px' }}>
                            {b.last_alerted_at ? new Date(b.last_alerted_at).toLocaleDateString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                      {barangays.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                            No barangays configured
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add new barangay */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #1f2937' }}>
                <h4 style={{ margin: '0 0 14px', fontWeight: 600, fontSize: '14px' }}>Add / Update Barangay</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <input
                    placeholder="Barangay name"
                    style={inputStyle}
                    value={newBrgy.barangay_name}
                    onChange={e => setNewBrgy({ ...newBrgy, barangay_name: e.target.value })}
                  />
                  <input
                    placeholder="recipient@email.com"
                    type="email"
                    style={inputStyle}
                    value={newBrgy.recipient_email}
                    onChange={e => setNewBrgy({ ...newBrgy, recipient_email: e.target.value })}
                  />
                  <input
                    placeholder="Threshold"
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={newBrgy.alert_threshold}
                    onChange={e => setNewBrgy({ ...newBrgy, alert_threshold: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <button
                  onClick={handleAddBrgy}
                  style={{
                    padding: '8px 20px', background: '#3b82f6', color: '#fff',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                  }}
                >
                  Save Barangay
                </button>
                {addMsg && <span style={{ marginLeft: '12px', fontSize: '13px', color: '#6ee7b7' }}>{addMsg}</span>}
              </div>
            </div>

            {/* Alert history */}
            <div style={{ background: '#111827', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontWeight: 600 }}>Alert Send History</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Sent At', 'Barangay', 'Records', 'Recipient', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alertHistory.map((a, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                        <td style={{ padding: '8px 10px', color: '#9ca3af' }}>
                          {new Date(a.sent_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#e5e7eb' }}>{a.barangay}</td>
                        <td style={{ padding: '8px 10px', color: '#e5e7eb' }}>{a.pothole_count}</td>
                        <td style={{ padding: '8px 10px', color: '#9ca3af' }}>{a.recipient_email}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                            background: a.status === 'sent' ? '#064e3b' : '#7f1d1d',
                            color:      a.status === 'sent' ? '#6ee7b7' : '#fca5a5'
                          }}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                    {alertHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                          No alerts sent yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── STORAGE TAB ── */}
        {activeTab === 'storage' && (
          <div style={{ background: '#111827', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 600 }}>Supabase Storage Status</h3>

            {storageStatus ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: '#1f2937', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>Total Records (DB)</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{storageStatus.total_records}</div>
                  </div>
                  <div style={{ background: '#1f2937', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>Images in Storage</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>{storageStatus.files_in_storage?.images}</div>
                  </div>
                  <div style={{ background: '#1f2937', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>Videos in Storage</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#8b5cf6' }}>{storageStatus.files_in_storage?.videos}</div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '14px', color: '#9ca3af' }}>Detections by Source</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {Object.entries(storageStatus.detections_by_source || {}).map(([src, cnt]) => (
                      <div key={src} style={{ background: '#1a2332', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>{src}</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#e5e7eb' }}>{cnt}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '14px', color: '#9ca3af' }}>Storage Bucket Paths</h4>
                  {Object.entries(storageStatus.storage_paths || {}).map(([folder, url]) => (
                    <div key={folder} style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize', display: 'inline-block', width: '70px' }}>{folder}</span>
                      <a
                        href={url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#3b82f6', wordBreak: 'break-all' }}
                      >
                        {url}
                      </a>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', fontSize: '12px', color: '#6b7280' }}>
                  Bucket: <strong style={{ color: '#e5e7eb' }}>{storageStatus.bucket}</strong> &nbsp;·&nbsp;
                  Supabase: <strong style={{ color: '#e5e7eb' }}>{storageStatus.supabase_url}</strong>
                </div>

                <button
                  onClick={loadStorage}
                  style={{
                    marginTop: '16px', padding: '8px 18px', background: '#1f2937',
                    border: '1px solid #374151', borderRadius: '6px',
                    color: '#9ca3af', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  Refresh
                </button>
              </>
            ) : (
              <div style={{ color: '#9ca3af' }}>Loading storage status...</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}