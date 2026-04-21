import { useState, useRef, useEffect, useCallback } from 'react'
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

export default function Webcam() {
  const navigate = useNavigate()
  const [active,     setActive]     = useState(false)
  const [potholes,   setPotholes]   = useState([])
  const [log,        setLog]        = useState([])
  const [status,     setStatus]     = useState('Camera off')
  const [error,      setError]      = useState(null)

  // Collected frames with detections (in memory, not yet saved)
  const [pendingFrames, setPendingFrames] = useState([])

  // Save prompt
  const [showSave,   setShowSave]   = useState(false)
  const [barangay,   setBarangay]   = useState('')
  const [location,   setLocation]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)

  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const overlayRef = useRef(null)
  const streamRef  = useRef(null)
  const timerRef   = useRef(null)
  const pendingRef = useRef([])   // keep in sync with state for use in callbacks

  const drawBoxes = useCallback((boxes, vw, vh) => {
    const canvas = overlayRef.current; if (!canvas) return
    canvas.width = vw; canvas.height = vh
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, vw, vh)
    boxes.forEach((p) => {
      const [x, y, w, h] = p.bbox
      const col = SEV[p.severity] || '#6366f1'
      const fs  = Math.max(11, vw / 50)
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = col + '18'; ctx.fillRect(x, y, w, h)
      const label = `${p.severity}  ${Math.round(p.confidence)}%`
      ctx.font = `bold ${fs}px sans-serif`
      const tw = ctx.measureText(label).width + 10
      const ly = y > fs + 4 ? y - fs - 6 : y + h + 2
      ctx.fillStyle = col; ctx.fillRect(x, ly, tw, fs + 8)
      ctx.fillStyle = '#fff'; ctx.fillText(label, x + 5, ly + fs + 2)
    })
  }, [])

  const capture = useCallback(async () => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    const vw = video.videoWidth; const vh = video.videoHeight
    canvas.width = vw; canvas.height = vh
    canvas.getContext('2d').drawImage(video, 0, 0)

    canvas.toBlob(async blob => {
      try {
        const fd = new FormData()
        fd.append('file', blob, 'frame.jpg')
        fd.append('analyze_only', 'true')   // display only — user decides to save on Stop
        const res  = await fetch(API('/api/pothole/detect'), { method: 'POST', body: fd })
        const data = await res.json()
        const found = data.potholes || []
        setPotholes(found)
        drawBoxes(found, vw, vh)
        if (found.length > 0) {
          const entry = { time: new Date().toLocaleTimeString(), count: found.length, potholes: found, blob }
          setLog(prev => [entry, ...prev.slice(0, 19)])
          // Store frame blob for potential saving later
          pendingRef.current = [entry, ...pendingRef.current.slice(0, 29)]
          setPendingFrames(pendingRef.current)
        }
      } catch { /* silent */ }
    }, 'image/jpeg', 0.75)
  }, [drawBoxes])

  const start = async () => {
    setError(null); setSaveMsg(null); setShowSave(false)
    setPendingFrames([]); pendingRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setActive(true); setStatus('Live — detecting...')
      timerRef.current = setInterval(capture, 1500)
    } catch {
      setError('Camera access denied. Allow camera permissions in your browser and try again.')
    }
  }

  const stop = () => {
    clearInterval(timerRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current)  videoRef.current.srcObject = null
    const c = overlayRef.current; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setActive(false); setPotholes([]); setStatus('Camera off')

    // Prompt to save if any detections happened
    if (pendingRef.current.length > 0) {
      setShowSave(true)
    }
  }

  // Save selected frames to DB with location
  const handleSave = async () => {
    if (pendingFrames.length === 0) return
    setSaving(true); setSaveMsg(null)
    let saved = 0
    try {
      for (const frame of pendingFrames) {
        const fd = new FormData()
        fd.append('file', frame.blob, 'webcam_frame.jpg')
        fd.append('barangay', barangay)
        fd.append('location', location)
        fd.append('analyze_only', 'false')
        const res  = await fetch(API('/api/pothole/detect'), { method: 'POST', body: fd })
        const data = await res.json()
        if (data.success) saved += data.potholes_detected || 0
      }
      setShowSave(false)
      setTimeout(() => navigate('/dashboard'), 1200)
      setPendingFrames([]); pendingRef.current = []
    } catch {
      setSaveMsg({ err: 'Network error — could not save.' })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => () => stop(), [])

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: '#1f2937', border: '1px solid #374151',
    borderRadius: 6, color: '#e5e7eb', fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Live Stream</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Real-time pothole detection — preview only while live</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#10b981' : '#374151', boxShadow: active ? '0 0 6px #10b981' : 'none' }} />
            <span style={{ fontSize: 13, color: active ? '#10b981' : '#6b7280' }}>{status}</span>
          </div>
          <button onClick={active ? stop : start} style={{ padding: '9px 20px', background: active ? '#1f1f1f' : '#6366f1', color: active ? '#ef4444' : '#fff', border: active ? '1px solid #ef444444' : 'none', borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            {active ? 'Stop & Save?' : 'Start Camera'}
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 20px', fontSize: 12, color: '#4b5563' }}>
        ℹ️ Detections are shown live but not saved. When you stop, you can choose to save the session with a location.
      </p>

      {error && <div style={{ padding: '12px 16px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

      {saveMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, background: saveMsg.ok ? '#052e16' : '#1f0a0a', color: saveMsg.ok ? '#6ee7b7' : '#f87171', border: `1px solid ${saveMsg.ok ? '#065f46' : '#7f1d1d'}` }}>
          {saveMsg.ok || saveMsg.err}
        </div>
      )}

      {/* Save prompt */}
      {showSave && (
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>Save Session to Database?</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
            {pendingFrames.length} frame(s) with detections captured. Add location then save — or discard.
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
              {saving ? 'Saving...' : 'Save Session'}
            </button>
            <button
              onClick={() => { setShowSave(false); setSaveMsg({ ok: 'Session discarded — not saved.' }); setPendingFrames([]); pendingRef.current = [] }}
              style={{ padding: '9px 22px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ position: 'relative', background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', overflow: 'hidden', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: active ? 'block' : 'none' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: active ? 'block' : 'none' }} />
            {!active && (
              <div style={{ textAlign: 'center', color: '#374151' }}>
                <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.3 }}>[ ]</div>
                <p style={{ margin: 0, fontSize: 14 }}>Press Start Camera to begin</p>
              </div>
            )}
            {active && (
              <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
                <span style={{ background: '#00000088', color: '#10b981', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>● Live</span>
                <span style={{ background: '#37415188', color: '#9ca3af', padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>Preview only</span>
                {potholes.length > 0 && (
                  <span style={{ background: '#ef444488', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{potholes.length} pothole{potholes.length > 1 ? 's' : ''}</span>
                )}
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div style={{ background: '#111111', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>Detection Log <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 400 }}>(not saved yet)</span></span>
            {log.length > 0 && <button onClick={() => setLog([])} style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: 12, cursor: 'pointer' }}>Clear</button>}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {log.length === 0 ? (
              <p style={{ padding: '20px 16px', color: '#374151', fontSize: 13, margin: 0, textAlign: 'center' }}>No detections yet</p>
            ) : log.map((d, i) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{d.time}</span>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {d.potholes.map((p, j) => {
                      const col = SEV[p.severity] || '#6366f1'
                      return <span key={j} style={{ background: col + '22', color: col, border: `1px solid ${col}44`, padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.severity}</span>
                    })}
                  </div>
                </div>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}