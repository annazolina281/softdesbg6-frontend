import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d0d', color: '#e5e7eb' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', maxWidth: '100%' }}>
        {children}
      </main>
    </div>
  )
}