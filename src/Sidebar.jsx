import { NavLink } from 'react-router-dom'

const nav = [
  { label: 'Dashboard',    to: '/dashboard' },
  { label: 'Images',       to: '/images'    },
  { label: 'Videos',       to: '/videos'    },
  { label: 'Live Stream',  to: '/webcam'    },
  { label: 'Settings',     to: '/settings'  },
]

export default function Sidebar() {
  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: '#111111',
      borderRight: '1px solid #1a1a1a',
      padding: '0',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '0.01em' }}>
          Pothole Detection System
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>Road Infrastructure Monitoring</div>
      </div>

      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'block',
              padding: '10px 14px',
              borderRadius: 7,
              marginBottom: 2,
              color:      isActive ? '#ffffff' : '#6b7280',
              background: isActive ? '#1e1e2e' : 'transparent',
              borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              transition: 'all 0.15s',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 11, color: '#374151' }}>v1.0.0 — YOLO + Supabase</div>
      </div>
    </aside>
  )
}