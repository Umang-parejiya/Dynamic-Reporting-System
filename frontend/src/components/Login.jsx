import React, { useState } from 'react'
import { useStore } from '../store'
import { Lock, Mail, Loader2, BarChart3 } from 'lucide-react'

export default function Login() {
  const { login, authLoading } = useStore()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || 'Invalid email or password')
    }
  }

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1e293b, #0f172a)', overflow: 'hidden'
    }}>
      <div className="card" style={{
        width: 400, padding: '40px 30px', 
        background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 16, background: 'var(--accent)',
            marginBottom: 16, boxShadow: '0 0 20px var(--accent)'
          }}>
            <BarChart3 color="#fff" size={32} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Dynamic Reports</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ 
              padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8,
              fontSize: 12, color: '#f87171', textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text3)' }} />
              <input 
                className="input" type="email" placeholder="name@company.com" 
                style={{ width: '100%', paddingLeft: 40 }} 
                value={email} onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text3)' }} />
              <input 
                className="input" type="password" placeholder="••••••••" 
                style={{ width: '100%', paddingLeft: 40 }} 
                value={password} onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ height: 44, fontSize: 14, marginTop: 10, gap: 8 }}
            disabled={authLoading}
          >
            {authLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 30, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Demo: <code style={{ color: 'var(--accent)' }}>admin@example.com</code> / <code style={{ color: 'var(--accent)' }}>password123</code>
          </p>
        </div>
      </div>
    </div>
  )
}
