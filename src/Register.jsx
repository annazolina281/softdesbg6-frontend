import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function Register() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError(null)

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      // Auto sign in after register and go to dashboard
      await supabase.auth.signInWithPassword({ email, password })
      navigate('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, background: '#111111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '36px 32px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#ffffff' }}>Create Account</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280' }}>Join Pothole Detection System</p>

        {error && (
          <div style={{ padding: '10px 14px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 7, color: '#f87171', marginBottom: 18, fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Juan dela Cruz"
              style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 7, color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 7, color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #2a2a2a', borderRadius: 7, color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '11px', background: loading ? '#374151' : '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#6366f1', fontWeight: 500 }}>Sign In</Link>
        </p>
      </div>
    </div>
  )
}