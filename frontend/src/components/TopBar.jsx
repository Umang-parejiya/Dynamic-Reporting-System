import React, { useState } from 'react'
import { useStore } from '../store'
import {
  Menu, Search, RefreshCw, Download, Table2, BarChart2,
  BookMarked, Upload, ChevronDown, User, LogOut
} from 'lucide-react'

export default function TopBar() {
  const {
    query, loading, total, activeTab, setActiveTab,
    setSidebarOpen, sidebarOpen, rows, setRows,
    results, selectedColumns, schema,
    user, logout
  } = useStore()

  const [showExport, setShowExport] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const exportCSV = () => {
    const cols = selectedColumns.length ? selectedColumns : Object.keys(results[0] || {})
    const header = cols.join(',')
    const rows_data = results.map(r => cols.map(c => {
      const v = r[c] ?? ''
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    }).join(','))
    const csv = [header, ...rows_data].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `report_${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  const triggerProducer = async () => {
    setTriggering(true)
    try {
      await fetch('/api/produce', { method: 'POST' })
      setTimeout(() => query(), 3000)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="top-bar-container" style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 20px',
      background: 'var(--bg2)',
      backdropFilter: 'var(--glass)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Sidebar Toggle */}
      <button 
        className="btn btn-icon" 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ width: 36, height: 36, padding: 0, border: 'none' }}
      >
        <Menu size={18} />
      </button>

      {/* Title Section */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
          {activeTab === 'table' ? 'Data Explorer' : activeTab === 'charts' ? 'Visual Analytics' : 'Audit Intelligence'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
          Analyzing {total.toLocaleString()} unique records
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* View Toggle */}
      <div style={{
        display: 'flex', background: 'var(--bg3)',
        border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden'
      }}>
        {[
          { id: 'table', icon: <Table2 size={14} />, label: 'Table' },
          { id: 'charts', icon: <BarChart2 size={14} />, label: 'Charts' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 500,
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text2)',
              transition: 'all .15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Rows Per Page */}
      <select
        className="input"
        style={{ width: 90, fontSize: 12 }}
        value={rows}
        onChange={e => setRows(Number(e.target.value))}
      >
        {[20, 50, 100, 200, 500].map(n => (
          <option key={n} value={n}>{n} rows</option>
        ))}
      </select>

      {/* Upload / Produce */}
      <button
        className="btn"
        onClick={triggerProducer}
        disabled={triggering}
        data-tip="Re-index CSV files"
        style={{ gap: 5 }}
      >
        <Upload size={14} className={triggering ? 'animate-spin' : ''} />
        {triggering ? 'Indexing...' : 'Index CSV'}
      </button>

      {/* Refresh */}
      <button className="btn btn-icon" onClick={query} disabled={loading} data-tip="Refresh">
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
      </button>

      {/* Export */}
      <div style={{ position: 'relative' }}>
        <button
          className="btn"
          onClick={() => setShowExport(!showExport)}
          style={{ gap: 5 }}
        >
          <Download size={14} /> Export <ChevronDown size={12} />
        </button>
        {showExport && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)',
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 8, overflow: 'hidden', zIndex: 100, minWidth: 140,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          }}>
            <button
              onClick={exportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text)', fontSize: 13, textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              📄 Export CSV
            </button>
          </div>
        )}
      </div>

      {/* User Profile Badge */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: 10, 
        padding: '4px 4px 4px 12px', background: 'var(--bg3)', 
        borderRadius: '20px', border: '1px solid var(--border2)',
        marginLeft: 8
      }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{user?.name}</div>
          <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {user?.role}
          </div>
        </div>
        <div style={{ 
          width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
        }}>
          <User size={14} />
        </div>
        <button 
          onClick={logout}
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer',
            width: 28, height: 28, borderRadius: '50%', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: '#EF4444',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  )
}
