import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const cards = [
    { title: 'Groups', description: 'Manage employer groups and census', icon: '🏢', path: '/groups', color: '#1B4F8A' },
    { title: 'Quotes', description: 'Create and manage quotes', icon: '📋', path: '/quotes', color: '#2E75B6' },
    { title: 'Rate Tables', description: 'View and upload carrier rates', icon: '💰', path: '/rates', color: '#1A7A3C' },
    { title: 'Settings', description: 'Branding and account settings', icon: '⚙️', path: '/settings', color: '#6B7280' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', fontFamily: 'Arial, sans-serif' }}>

      {/* Top navigation bar */}
      <nav style={{
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#1B4F8A',
          margin: 0,
          letterSpacing: '-0.5px'
        }}>
          BrokerIQ
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#6B7280' }}>
            {user?.email}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#374151',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#F3F4F6'
              e.target.style.borderColor = '#9CA3AF'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
              e.target.style.borderColor = '#D1D5DB'
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ padding: '40px 32px' }}>

        {/* Welcome header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#111827',
            margin: '0 0 8px 0'
          }}>
            Welcome back
          </h2>
          <p style={{ color: '#6B7280', margin: 0, fontSize: '15px' }}>
            California Group Health Quoting Platform
          </p>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px'
        }}>
          {[
            { label: 'Active Groups', value: '—' },
            { label: 'Open Quotes', value: '—' },
            { label: 'Sent Quotes', value: '—' },
            { label: 'Rate Tables', value: '—' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'white',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #E5E7EB'
            }}>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 6px 0', fontWeight: '500' }}>
                {stat.label}
              </p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Navigation cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
          maxWidth: '800px'
        }}>
          {cards.map((card) => (
            <div
              key={card.title}
              onClick={() => navigate(card.path)}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '28px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: card.color + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0
              }}>
                {card.icon}
              </div>
              <div>
                <h3 style={{
                  fontSize: '17px',
                  fontWeight: '600',
                  color: '#111827',
                  margin: '0 0 4px 0'
                }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}