import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login       from './Login'
import Register    from './Register'
import Dashboard   from './Dashboard'
import ImageUpload from './ImageUpload'
import VideoUpload from './VideoUpload'
import Webcam      from './Webcam'
import Settings    from './Settings'

// Protects routes — redirects to /login if not signed in
function PrivateRoute({ session, children }) {
  if (session === null) return <Navigate to="/login" replace />
  if (session === undefined) return null  // still loading
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)  // undefined = loading

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    // Listen for login/logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Show nothing while checking auth (avoids flash)
  if (session === undefined) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#4b5563', fontSize: 14 }}>Loading...</div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        <Route path="/login"    element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={session ? <Navigate to="/dashboard" replace /> : <Register />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<PrivateRoute session={session}><Dashboard /></PrivateRoute>} />
        <Route path="/images"    element={<PrivateRoute session={session}><ImageUpload /></PrivateRoute>} />
        <Route path="/videos"    element={<PrivateRoute session={session}><VideoUpload /></PrivateRoute>} />
        <Route path="/webcam"    element={<PrivateRoute session={session}><Webcam /></PrivateRoute>} />
        <Route path="/settings"  element={<PrivateRoute session={session}><Settings /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}