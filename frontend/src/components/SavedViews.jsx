import React, { useState } from 'react'
import { useStore } from '../store'
import { BookMarked, X, Save, Trash2, Star, Check } from 'lucide-react'

export default function SavedViews() {
  const { 
    views, saveView, loadView, deleteView,
    reports, fetchReports, saveReport, deleteReport, user
  } = useStore()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('views') // 'views' | 'reports'
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!newName.trim()) return
    setSaving(true)
    let success = false
    if (tab === 'views') {
      success = await saveView({ name: newName.trim(), is_default: isDefault })
    } else {
      success = await saveReport(newName.trim())
    }
    
    if (success) {
      setNewName('')
      setIsDefault(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <>
      {/* Trigger Button - fixed */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 28, right: 28,
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', boxShadow: '0 4px 20px rgba(108,99,255,.5)',
          transition: 'transform .2s, box-shadow .2s',
          zIndex: 200,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(108,99,255,.7)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(108,99,255,.5)' }}
        data-tip="Saved Views"
      >
        <BookMarked size={20} />
        {views.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--accent2)', color: '#fff', fontSize: 10,
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg)',
          }}>
            {views.length}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 150 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 340,
        background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)',
        zIndex: 151,
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s ease',
        boxShadow: open ? 'var(--shadow)' : 'none',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', gap: 15 }}>
            <button 
              onClick={() => setTab('views')}
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: 14, fontWeight: tab === 'views' ? 700 : 500,
                color: tab === 'views' ? 'var(--accent)' : 'var(--text3)',
                borderBottom: tab === 'views' ? '2px solid var(--accent)' : '2px solid transparent'
              }}
            >
              My Views
            </button>
            <button 
              onClick={() => setTab('reports')}
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: 14, fontWeight: tab === 'reports' ? 700 : 500,
                color: tab === 'reports' ? 'var(--accent)' : 'var(--text3)',
                borderBottom: tab === 'reports' ? '2px solid var(--accent)' : '2px solid transparent'
              }}
            >
              Reports
            </button>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Save New */}
        {(tab === 'views' || user?.role === 'admin') && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              {tab === 'views' ? 'Save Personal View' : 'Publish Global Report'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder={tab === 'views' ? "View name..." : "Report name..."}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  style={{ fontSize: 12, flex: 1 }}
                />
                <button
                  className={`btn ${saved ? '' : 'btn-primary'}`}
                  onClick={handleSave}
                  disabled={saving || !newName.trim()}
                  style={saved ? { background: 'var(--success)', borderColor: 'var(--success)', color: '#fff' } : {}}
                >
                  {saved ? <Check size={14} /> : (tab === 'views' ? <Save size={14} /> : <PlusCircle size={14} />)}
                </button>
              </div>
              
              {tab === 'views' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  Set as Default
                </label>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {tab === 'views' ? (
            views.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 12 }}>
                <div>No personal views yet</div>
              </div>
            ) : (
              views.map(v => (
                <ViewCard
                  key={v.id}
                  view={v}
                  onLoad={() => { loadView(v); setOpen(false) }}
                  onDelete={() => deleteView(v.id)}
                />
              ))
            )
          ) : (
            reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 12 }}>
                <div>No global reports available</div>
              </div>
            ) : (
              reports.map(r => (
                <ViewCard
                  key={r.id}
                  view={r}
                  isReport={true}
                  onLoad={() => { loadView(r); setOpen(false) }}
                  onDelete={() => deleteReport(r.id)}
                  canDelete={user?.role === 'admin'}
                />
              ))
            )
          )}
        </div>
      </div>
    </>
  )
}

function ViewCard({ view, onLoad, onDelete, isReport, canDelete = true }) {
  const [hovering, setHovering] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid var(--border2)',
        marginBottom: 8,
        background: hovering ? 'var(--bg3)' : 'transparent',
        transition: 'all .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {view.name}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {view.columns?.length > 0 && (
              <span className="badge">{view.columns.length} columns</span>
            )}
            {view.filters?.length > 0 && (
              <span className="badge badge-accent">{view.filters.length} filters</span>
            )}
            {view.is_default && (
              <span className="badge badge-success"><Star size={9} /> Default</span>
            )}
            {view.shared_with_team && (
              <span className="badge" style={{ background: 'var(--accent3)', color: '#fff', borderColor: 'var(--accent3)' }}>Shared</span>
            )}
            {view.version > 1 && (
              <span className="badge" style={{ background: 'var(--bg3)' }}>v{view.version}</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
            {new Date(view.created_at).toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={onLoad}>Load</button>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{
                background: 'none', border: '1px solid transparent', padding: '4px 6px',
                borderRadius: 6, cursor: 'pointer', color: 'var(--text3)',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
