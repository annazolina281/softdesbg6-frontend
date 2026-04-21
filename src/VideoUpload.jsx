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

const SAMPLES = [
  { label: 'Sample 1 — Dry Pothole',         src: '/samples/sample1.mp4' },
  { label: 'Sample 2 — Water-filled Pothole', src: '/samples/sample2.mp4' },
  { label: 'Sample 3 — Multiple Potholes',    src: '/samples/sample3.mp4' },
  { label: 'Sample 4 — Road Surface Damage',  src: '/samples/sample4.mp4' },
  { label: 'Sample 5 — Severe Road Damage',   src: '/samples/sample5.mp4' },
]

export default function VideoUpload() {
  const navigate = useNavigate()
  const [tab,         setTab]         = useState('upload')
  const [videoURL,    setVideoURL]    = useState(null)
  const [videoFile,   setVideoFile]   = useState(null)
  const [fileName,    setFileName]    = useState(null)
  const [error,       setError]       = useState(null)
  const [dragOver,    setDragOver]    = useState(false)

  // Scan mode
  const [scanning,    setScanning]    = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [results,     setResults]     = useState([])
  const [summary,     setSummary]     = useState(null)
  const [activeFrame, setActiveFrame] = useState(null)
  const [scanDets,    setScanDets]    = useState([])   // raw detections from scan

  // Save prompt after scan
  const [showSave,    setShowSave]    = useState(false)
  const [barangay,    setBarangay]    = useState('')
  const [location,    setLocation]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null)

  // Live mode — display only, no saving
  const [liveMode,    setLiveMode]    = useState(false)
  const [livePots,    setLivePots]    = useState([])
  const [detecting,   setDetecting]   = useState(false)
  const [liveLog,     setLiveLog]     = useState([])

  const videoRef      = useRef(null)
  const captureCanvas = useRef(null)
  const overlayRef    = useRef(null)
  const previewImg    = useRef(null)
  const previewCanvas = useRef(null)
  const liveTimer     = useRef(null)
  const detecting_ref = useRef(false)

  // Draw scan result boxes
  const drawScanBoxes = useCallback((potholes, w, h) => {
    const canvas = previewCanvas.current
    if (!canvas) return
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)
    potholes.forEach((p, i) => {
      const [x, y, bw, bh] = p.bbox
      const col = SEV[p.severity] || '#6366f1'
      const fs  = Math.max(12, w / 55)
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, w / 250)
      ctx.strokeRect(x, y, bw, bh)
      ctx.fillStyle = col + '22'; ctx.fillRect(x, y, bw, bh)
      ctx.font = `bold ${fs}px sans-serif`
      const label = `#${i + 1}  ${p.severity}  ${Math.round(p.confidence)}%`
      const tw    = ctx.measureText(label).width + 12
      const ly    = y > fs + 6 ? y - fs - 8 : y + bh + 4
      ctx.fillStyle = col; ctx.fillRect(x, ly, tw, fs + 10)
      ctx.fillStyle = '#fff'; ctx.fillText(label, x + 6, ly + fs + 3)
    })
  }, [])

  // Draw live boxes on video overlay
  const drawLiveBoxes = useCallback((potholes) => {
    const canvas = overlayRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    canvas.width  = video.videoWidth  || video.clientWidth
    canvas.height = video.videoHeight || video.clientHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    potholes.forEach((p, i) => {
      const [x, y, bw, bh] = p.bbox
      const col = SEV[p.severity] || '#6366f1'
      const fs  = Math.max(11, canvas.width / 55)
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, canvas.width / 300)
      ctx.strokeRect(x, y, bw, bh)
      ctx.fillStyle = col + '22'; ctx.fillRect(x, y, bw, bh)
      ctx.font = `bold ${fs}px sans-serif`
      const label = `${p.severity} ${Math.round(p.confidence)}%`
      const tw    = ctx.measureText(label).width + 10
      const ly    = y > fs + 4 ? y - fs - 6 : y + bh + 2
      ctx.fillStyle = col; ctx.fillRect(x, ly, tw, fs + 8)
      ctx.fillStyle = '#fff'; ctx.fillText(label, x + 5, ly + fs + 2)
    })
  }, [])

  useEffect(() => {
    if (!activeFrame || !previewImg.current) return
    const img  = previewImg.current
    const draw = () => drawScanBoxes(activeFrame.potholes, img.naturalWidth, img.naturalHeight)
    if (img.complete) draw(); else img.onload = draw
  }, [activeFrame, drawScanBoxes])

  // ── Live detection — analyze only, NO saving ────────────────
  const detectLiveFrame = useCallback(async () => {
    if (detecting_ref.current) return
    const video  = videoRef.current
    const canvas = captureCanvas.current
    if (!video || !canvas || video.paused || video.ended) return

    detecting_ref.current = true
    setDetecting(true)

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)

    await new Promise(resolve => {
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(); return }
        try {
          const fd = new FormData()
          fd.append('file', blob, 'frame.jpg')
          fd.append('analyze_only', 'true')   // ← display only, never saves
          const res  = await fetch(API('/api/pothole/detect'), { method: 'POST', body: fd })
          const data = await res.json()
          const pots = data.potholes || []
          setLivePots(pots)
          drawLiveBoxes(pots)
          if (pots.length > 0) {
            setLiveLog(prev => [{
              time:     video.currentTime.toFixed(1),
              count:    pots.length,
              potholes: pots,
            }, ...prev.slice(0, 29)])
          }
        } catch { /* silent */ }
        resolve()
      }, 'image/jpeg', 0.80)
    })

    detecting_ref.current = false
    setDetecting(false)
  }, [drawLiveBoxes])

  useEffect(() => {
    if (liveMode) {
      liveTimer.current = setInterval(detectLiveFrame, 1200)
    } else {
      clearInterval(liveTimer.current)
      setLivePots([])
      const canvas = overlayRef.current
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    }
    return () => clearInterval(liveTimer.current)
  }, [liveMode, detectLiveFrame])

  // ── Scan mode — analyze then prompt to save ─────────────────
  const waitForVideo = (video) => new Promise((resolve, reject) => {
    if (video.readyState >= 2) { resolve(); return }
    video.onloadeddata = resolve
    video.onerror = reject
    setTimeout(reject, 10000)
  })

  const scanFrame = (video, canvas, time, fname) => new Promise(resolve => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      canvas.width  = video.videoWidth  || 640
      canvas.height = video.videoHeight || 480
      canvas.getContext('2d').drawImage(video, 0, 0)
      const imageURL = canvas.toDataURL('image/jpeg', 0.85)
      canvas.toBlob(async blob => {
        if (!blob) { resolve({ time, potholes: [], imageURL }); return }
        try {
          const fd = new FormData()
          fd.append('file', blob, 'frame.jpg')
          fd.append('analyze_only', 'true')   // analyze only — user saves at the end
          const res  = await fetch(API('/api/pothole/detect'), { method: 'POST', body: fd })
          const data = await res.json()
          resolve({ time, potholes: data.potholes || [], imageURL })
        } catch { resolve({ time, potholes: [], imageURL }) }
      }, 'image/jpeg', 0.85)
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })

  const runScan = useCallback(async () => {
    setScanning(true)
    setError(null)
    setResults([])
    setSummary(null)
    setProgress(0)
    setActiveFrame(null)
    setLiveMode(false)
    setLiveLog([])
    setShowSave(false)
    setSaveMsg(null)
    setScanDets([])

    await new Promise(res => setTimeout(res, 800))
    const video = videoRef.current
    if (!video) { setScanning(false); return }

    try { await waitForVideo(video) }
    catch { setError('Could not load video.'); setScanning(false); return }

    const duration = video.duration
    if (!duration || isNaN(duration) || duration === Infinity) {
      setError('Could not read video duration.')
      setScanning(false)
      return
    }

    const interval = Math.max(2, duration / 30)
    const times    = []
    for (let t = 0; t < duration; t += interval) times.push(parseFloat(t.toFixed(2)))

    const frames = []
    for (let i = 0; i < times.length; i++) {
      const r = await scanFrame(video, captureCanvas.current, times[i], fileName || 'video')
      if (r) {
        frames.push(r)
        if (r.potholes.length > 0) setActiveFrame(r)
      }
      setProgress(Math.round(((i + 1) / times.length) * 100))
    }

    if (!frames.some(f => f.potholes.length > 0) && frames.length > 0) {
      setActiveFrame(frames[frames.length - 1])
    }

    const all = frames.flatMap(f => f.potholes)
    setScanDets(all)
    setSummary({
      total: all.length,
      high:  all.filter(p => p.severity === 'High').length,
      med:   all.filter(p => p.severity === 'Medium').length,
      low:   all.filter(p => p.severity === 'Low').length,
      hits:  frames.filter(f => f.potholes.length > 0).length,
      totalFrames: times.length,
    })
    setResults(frames.filter(f => f.potholes.length > 0))
    setScanning(false)

    // Show save prompt if potholes found
    if (all.length > 0) setShowSave(true)
  }, [fileName])

  // Save scan results with location
  const handleSave = async () => {
    if (!videoFile) { setSaveMsg({ err: 'No video file to save (samples cannot be saved to DB).' }); setShowSave(false); return }
    setSaving(true); setSaveMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', videoFile)
      fd.append('barangay', barangay)
      fd.append('location', location)
      const res  = await fetch(API('/api/pothole/detect-video'), { method: 'POST', body: fd })
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

  const loadVideo = (url, name, file = null) => {
    setVideoURL(url); setFileName(name); setVideoFile(file)
    setResults([]); setSummary(null); setActiveFrame(null)
    setLiveMode(false); setLiveLog([])
    setError(null); setShowSave(false); setSaveMsg(null); setScanDets([])
  }

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('video/')) { setError('Please upload a video file.'); return }
    loadVideo(URL.createObjectURL(file), file.name, file)
  }

  const statCard = (label, value, color) => (
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '16px 20px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color }}>{value}</p>
    </div>
  )

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: '#1f2937', border: '1px solid #374151',
    borderRadius: 6, color: '#e5e7eb', fontSize: 13,
    boxSizing: 'border-box',
  }

  return (
    <AppLayout>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Video Upload</h2>
      <p style={{ margin: '0 0 6px', fontSize: 14, color: '#6b7280' }}>
        Upload a road video — scan all frames or use Live Detection (preview only, not saved)
      </p>
      <p style={{ margin: '0 0 24px', fontSize: 12, color: '#4b5563' }}>
        ℹ️ Live Detection is for real-time preview only and does not save to the database. Use Scan All Frames to save detections.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: '#111', borderRadius: 8, padding: 4, width: 'fit-content', border: '1px solid #1a1a1a' }}>
        {[['upload', 'Upload Video'], ['samples', 'Sample Dataset']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 18px', borderRadius: 6, border: 'none',
            background: tab === id ? '#1e1e2e' : 'transparent',
            color: tab === id ? '#fff' : '#6b7280',
            fontWeight: tab === id ? 600 : 400, fontSize: 13, cursor: 'pointer',
            borderLeft: `2px solid ${tab === id ? '#6366f1' : 'transparent'}`,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
          style={{ border: `2px dashed ${dragOver ? '#6366f1' : '#2a2a2a'}`, borderRadius: 10, background: dragOver ? '#1a1a2e' : '#161616', padding: '40px 20px', textAlign: 'center', marginBottom: 24, transition: 'all 0.2s' }}
        >
          <p style={{ margin: '0 0 6px', color: '#d1d5db', fontWeight: 500 }}>Drag and drop a video here</p>
          <p style={{ margin: '0 0 20px', color: '#4b5563', fontSize: 12 }}>.mp4  .avi  .mov  .webm accepted</p>
          <label htmlFor="vid-up" style={{ padding: '9px 22px', background: '#6366f1', color: '#fff', borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-block' }}>
            Browse Videos
          </label>
          <input id="vid-up" type="file" accept="video/*" onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
          {fileName && <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>{fileName}</p>}
        </div>
      )}

      {tab === 'samples' && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            From the Mendeley Pothole Video Dataset — place .mp4 files in <code style={{ color: '#6366f1' }}>public/samples/</code>
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4b5563' }}>
            ⚠️ Sample videos are for preview only and cannot be saved to the database.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
            {SAMPLES.map(v => (
              <button key={v.src}
                onClick={() => { setTab('upload'); loadVideo(v.src, v.label, null) }}
                style={{ padding: '14px 16px', background: '#111111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#d1d5db', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>MP4 · Preview only</div>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ padding: '12px 16px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 8, color: '#f87171', marginBottom: 20, fontSize: 14 }}>{error}</div>}

      {saveMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, background: saveMsg.ok ? '#052e16' : '#1f0a0a', color: saveMsg.ok ? '#6ee7b7' : '#f87171', border: `1px solid ${saveMsg.ok ? '#065f46' : '#7f1d1d'}` }}>
          {saveMsg.ok || saveMsg.err}
        </div>
      )}

      {videoURL && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 700, marginBottom: 14 }}>
            <video
              ref={videoRef}
              src={videoURL}
              controls
              style={{ width: '100%', borderRadius: 8, border: '1px solid #1f1f1f', background: '#000', display: 'block' }}
              crossOrigin="anonymous"
              preload="auto"
            />
            <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 8 }} />

            {liveMode && (
              <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: '#00000099', color: '#10b981', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {detecting ? 'Detecting...' : '● Live Preview'}
                </span>
                <span style={{ background: '#374151cc', color: '#9ca3af', padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>
                  Not saving
                </span>
                {livePots.length > 0 && (
                  <span style={{ background: '#ef444499', color: '#fff', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {livePots.length} pothole{livePots.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setLiveMode(v => !v); setScanning(false) }}
              disabled={scanning}
              style={{
                padding: '10px 20px', borderRadius: 7, fontWeight: 600, fontSize: 13,
                border: liveMode ? '1px solid #10b98144' : 'none',
                background: liveMode ? '#0a2a1a' : '#10b981',
                color: liveMode ? '#10b981' : '#fff',
                cursor: scanning ? 'not-allowed' : 'pointer',
              }}
            >
              {liveMode ? 'Stop Live Preview' : 'Live Detection (Preview)'}
            </button>

            <button
              onClick={runScan}
              disabled={scanning || liveMode}
              style={{
                padding: '10px 20px', borderRadius: 7, fontWeight: 600, fontSize: 13,
                background: scanning ? '#374151' : '#6366f1', color: '#fff', border: 'none',
                cursor: (scanning || liveMode) ? 'not-allowed' : 'pointer',
              }}
            >
              {scanning ? `Scanning... ${progress}%` : 'Scan All Frames'}
            </button>
          </div>

          {scanning && (
            <div style={{ marginTop: 14 }}>
              <div style={{ width: '100%', height: 6, background: '#1f1f1f', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
      )}

      <canvas ref={captureCanvas} style={{ display: 'none' }} />

      {/* Live log */}
      {liveMode && liveLog.length > 0 && (
        <div style={{ background: '#111111', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>Live Preview Log <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 400 }}>(not saved)</span></span>
            <button onClick={() => setLiveLog([])} style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: 12, cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {liveLog.map((entry, i) => (
              <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid #161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 40 }}>{entry.time}s</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {entry.potholes.map((p, j) => {
                      const col = SEV[p.severity] || '#6366f1'
                      return <span key={j} style={{ background: col + '22', color: col, border: `1px solid ${col}44`, padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.severity}</span>
                    })}
                  </div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save prompt after scan */}
      {showSave && !scanning && (
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>Save Scan Results?</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
            {scanDets.length} pothole(s) detected across {results.length} frame(s). Add location then save — or discard.
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
              {saving ? 'Saving...' : 'Save to Database'}
            </button>
            <button
              onClick={() => { setShowSave(false); setSaveMsg({ ok: 'Scan results discarded — not saved.' }) }}
              style={{ padding: '9px 22px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: 7, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Scan result preview */}
      {activeFrame && !scanning && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#9ca3af' }}>
              Best frame — {activeFrame.potholes.length} pothole{activeFrame.potholes.length !== 1 ? 's' : ''} at {activeFrame.time.toFixed(1)}s
            </p>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img ref={previewImg} src={activeFrame.imageURL} alt="frame" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, border: '1px solid #1f1f1f' }} />
              <canvas ref={previewCanvas} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
            </div>
          </div>
          <div>
            {summary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {statCard('Total',  summary.total, '#6366f1')}
                {statCard('High',   summary.high,  '#ef4444')}
                {statCard('Medium', summary.med,   '#f97316')}
                {statCard('Low',    summary.low,   '#eab308')}
                <div style={{ gridColumn: 'span 2' }}>
                  {statCard('Frames with detections', `${summary.hits} / ${summary.totalFrames}`, '#10b981')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && !scanning && (
        <div style={{ background: '#111111', borderRadius: 10, border: '1px solid #1a1a1a', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>{results.length} frames with detections</span>
            <span style={{ fontSize: 12, color: '#4b5563', marginLeft: 8 }}>— click a row to preview that frame</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#161616' }}>
                {['Timestamp', 'Potholes', 'Detections'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} onClick={() => setActiveFrame(r)}
                  style={{ borderTop: '1px solid #161616', cursor: 'pointer', background: activeFrame?.time === r.time ? '#1e1e2e' : 'transparent' }}
                  onMouseEnter={e => { if (activeFrame?.time !== r.time) e.currentTarget.style.background = '#161616' }}
                  onMouseLeave={e => { if (activeFrame?.time !== r.time) e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#9ca3af' }}>{r.time.toFixed(1)}s</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#d1d5db', fontWeight: 600 }}>{r.potholes.length}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.potholes.map((p, j) => {
                        const col = SEV[p.severity] || '#6366f1'
                        return <span key={j} style={{ background: col + '22', color: col, border: `1px solid ${col}44`, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.severity} {Math.round(p.confidence)}%</span>
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}