import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import { API } from './api'

const SEV = { High: '#ef4444', Medium: '#f97316', Low: '#eab308' }

const BARANGAYS = [
  'Barangay Holy Spirit', 'Barangay Batasan Hills', 'Barangay Commonwealth',
  'Barangay Fairview', 'Barangay Novaliches', 'Barangay Payatas',
  'Barangay Bagong Silangan', 'Barangay Tandang Sora', 'Barangay Culiat',
  'Barangay Matandang Balara',
]

export default function ImageUpload() {
  const navigate = useNavigate()
  const [dragOver,    setDragOver]    = useState(false)
  const [analyzing,   setAnalyzing]   = useState(false)
  const [potholes,    setPotholes]    = useState([])
  const [imageURL,    setImageURL]    = useState(null)
  const [rawFile,     setRawFile]     = useState(null)
  const [fileName,    setFileName]    = useState(null)
  const [error,       setError]       = useState(null)

  // Location / save modal
  const [showSave,    setShowSave]    = useState(false)
  const [barangay,    setBarangay]    = useState('')
  const [location,    setLocation]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null)

  // Full-screen image viewer
  const [viewerOpen,  setViewerOpen]  = useState(false)

  const canvasRef = useRef(null)
  const imgRef    = useRef(null)

  // Draw bounding boxes on canvas
  useEffect(() => {
    if (!canvasRef.current || !imageURL || !potholes.length) return
    const img = imgRef.current
    if (!img) return
    const draw = () => {
      const canvas = canvasRef.current
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      potholes.forEach((p, i) => {
        const [x, y, w, h] = p.bbox
        const col = SEV[p.severity] || '#6366f1'
        const fs  = Math.max(12, canvas.width / 55)
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, canvas.width / 250)
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = col + '22'; ctx.fillRect(x, y, w, h)
        ctx.font = `bold ${fs}px sans-serif`
        const label = `#${i + 1}  ${p.severity}  ${Math.round(p.confidence)}%`
        const tw    = ctx.measureText(label).width + 12
        const ly    = y > fs + 6 ? y - fs - 8 : y + h + 4
        ctx.fillStyle = col; ctx.fillRect(x, ly, tw, fs + 10)
        ctx.fillStyle = '#fff'; ctx.fillText(label, x + 6, ly + fs + 3)
      })
    }
    if (img.complete) draw(); else img.onload = draw
  }, [potholes, imageURL])

  // Step 1: just analyze — do NOT save yet
  const handleAnalyze = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return }
    setAnalyzing(true); setError(null); setPotholes([])
    setSaveMsg(null); setShowSave(false)
    setImageURL(URL.createObjectURL(file))
    setRawFile(file)

    try {
      const fd = new FormData()
      fd.append('file', file)
      // analyze only — no barangay/location yet, backend won't save
      fd.append('analyze_only', 'true')
      const res  = await fetch(API('/api/pothole/detect'), { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setPotholes(data.potholes || [])
        if ((data.potholes || []).length > 0) setShowSave(true)
      } else {
        setError(data.error || 'Detection failed')
      }
    } catch {
      setError('Cannot reach backend. Make sure App.py is running on port 5000.')
    } finally {
      setAnalyzing(false)
    }
  }, [])

  // Step 2: user confirms save with location
  const handleSave = async () => {
    if (!rawFile) return
    setSaving(true); setSaveMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', rawFile)
      fd.append('barangay', barangay)
      fd.append('location', location)
      fd.append('analyze_only', 'false')
      const res  = await fetch(API('/api/pothole/detect'), { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        setShowSave(false)
        setTimeout(() => navigate('/dashboard'), 1200)
      } else {
        setSaveMsg({ err: data.error || 'Save failed.' })
      }
    } catch {
      setSaveMsg({ err: 'Network error — could not save.' })
    } finally {
      setSaving(false)
    }
  }

  const onFile = (f) => { if (f) { setFileName(f.name); handleAnalyze(f) } }

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: '#1f2937', border: '1px solid #374151',
    borderRadius: 6, color: '#e5e7eb', fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <AppLayout>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Image Upload</h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
        Upload a road image to detect potholes — you choose whether to save it
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]) }}
        style={{ border: `2px dashed ${dragOver ? '#6366f1' : '#2a2a2a'}`, borderRadius: 10, background: dragOver ? '#1a1a2e' : '#161616', padding: '40px 20px', textAlign: 'center', marginBottom: 24, transition: 'all 0.2s' }}
      >
        <p style={{ margin: '0 0 6px', color: '#d1d5db', fontWeight: 500 }}>Drag and drop an image here</p>
        <p style={{ margin: '0 0 20px', color: '#4b5563', fontSize: 12 }}>.jpg  .png  .webp  .bmp accepted</p>
        <label htmlFor="img-up" style={{ padding: '9px 22px', background: analyzing ? '#374151' : '#6366f1', color: '#fff', borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: analyzing ? 'not-allowed' : 'pointer', display: 'inline-block' }}>
          {analyzing ? 'Analyzing...' : 'Browse Images'}
        </label>
        <input id="img-up" type="file" accept="image/*" onChange={e => onFile(e.target.files[0])} disabled={analyzing} style={{ display: 'none' }} />
        {fileName && <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>{fileName}</p>}
      </div>

      {error && <div style={{ padding: '12px 16px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

      {saveMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, background: saveMsg.ok ? '#052e16' : '#1f0a0a', color: saveMsg.ok ? '#6ee7b7' : '#f87171', border: `1px solid ${saveMsg.ok ? '#065f46' : '#7f1d1d'}` }}>
          {saveMsg.ok || saveMsg.err}
        </div>
      )}

      {/* Image preview with bounding boxes */}
      {imageURL && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 14 }}>
              {analyzing ? 'Running detection...' : potholes.length > 0 ? `${potholes.length} pothole${potholes.length > 1 ? 's' : ''} detected` : 'No potholes found'}
            </p>
            {!analyzing && (
              <button
                onClick={() => setViewerOpen(true)}
                style={{ padding: '4px 14px', background: '#1f2937', border: '1px solid #374151', borderRadius: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
              >
                View Full Image
              </button>
            )}
          </div>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img ref={imgRef} src={imageURL} alt="upload" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, border: '1px solid #1f1f1f' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          </div>
        </div>
      )}

      {/* Save prompt — shown only when potholes detected */}
      {showSave && (
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>
            Save to Database?
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
            {potholes.length} pothole(s) detected. Add location details and save — or discard.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Barangay</label>
              <select style={inputStyle} value={barangay} onChange={e => setBarangay(e.target.value)}>
                <option value="">— Select Barangay —</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Location Note (optional)</label>
              <input
                style={inputStyle}
                placeholder="e.g. Near Puregold, corner of..."
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '9px 22px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : 'Save Detection'}
            </button>
            <button
              onClick={() => { setShowSave(false); setSaveMsg({ ok: 'Detection discarded — not saved.' }) }}
              style={{ padding: '9px 22px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Detection table */}
      {potholes.length > 0 && (
        <div style={{ background: '#111111', borderRadius: 10, border: '1px solid #1a1a1a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#161616' }}>
                {['#', 'Severity', 'Confidence', 'Size', 'Time'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {potholes.map((p, i) => {
                const col = SEV[p.severity] || '#6366f1'
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #161616' }}>
                    <td style={{ padding: '11px 16px', color: '#6b7280', fontSize: 13 }}>{i + 1}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ background: col + '22', color: col, border: `1px solid ${col}44`, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{p.severity}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 4, background: '#1f1f1f', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${p.confidence}%`, height: '100%', background: col, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 13, color: '#d1d5db' }}>{Math.round(p.confidence)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: '#9ca3af' }}>{p.bbox[2]} x {p.bbox[3]}px</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#4b5563' }}>{new Date(p.timestamp).toLocaleTimeString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Full-screen image viewer modal */}
      {viewerOpen && (
        <div
          onClick={() => setViewerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewerOpen(false)}
              style={{ position: 'absolute', top: -16, right: -16, width: 32, height: 32, borderRadius: '50%', background: '#374151', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 1001, lineHeight: '32px', textAlign: 'center' }}
            >×</button>
            <div style={{ position: 'relative' }}>
              <img src={imageURL} alt="full view" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, display: 'block' }} />
              {/* Redraw boxes at full size */}
              <canvas
                ref={c => {
                  if (!c || !potholes.length) return
                  const img = c.previousSibling
                  const draw = () => {
                    c.width = img.naturalWidth; c.height = img.naturalHeight
                    const ctx = c.getContext('2d')
                    ctx.clearRect(0, 0, c.width, c.height)
                    potholes.forEach((p, i) => {
                      const [x, y, w, h] = p.bbox
                      const col = SEV[p.severity] || '#6366f1'
                      const fs  = Math.max(14, c.width / 50)
                      ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, c.width / 200)
                      ctx.strokeRect(x, y, w, h)
                      ctx.fillStyle = col + '22'; ctx.fillRect(x, y, w, h)
                      ctx.font = `bold ${fs}px sans-serif`
                      const label = `#${i + 1} ${p.severity} ${Math.round(p.confidence)}%`
                      const tw = ctx.measureText(label).width + 12
                      const ly = y > fs + 6 ? y - fs - 8 : y + h + 4
                      ctx.fillStyle = col; ctx.fillRect(x, ly, tw, fs + 10)
                      ctx.fillStyle = '#fff'; ctx.fillText(label, x + 6, ly + fs + 3)
                    })
                  }
                  if (img.complete) draw(); else img.onload = draw
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
              />
            </div>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 8 }}>Click outside to close</p>
          </div>
        </div>
      )}
    </AppLayout>
  )
}