import React, { useState, useCallback } from 'react'
import { useStore } from '../store'
import { Eye, EyeOff, GripVertical, ChevronDown, ChevronRight, Activity, BarChart3, Table2 } from 'lucide-react'

export default function Sidebar() {
  const { 
    schema, selectedColumns, setSelectedColumns, columnOrder, setColumnOrder,
    sources, selectedSource, fetchSchema,
    user, activeTab, setActiveTab
  } = useStore()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const handleSourceChange = (e) => {
    fetchSchema(e.target.value)
  }

  // Group columns by suffix type
  const groups = {}
  schema.forEach(f => {
    const type = f.type || 'string'
    if (!groups[type]) groups[type] = []
    groups[type].push(f)
  })

  const filtered = schema.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleColumn = (name) => {
    setSelectedColumns(
      selectedColumns.includes(name)
        ? selectedColumns.filter(c => c !== name)
        : [...selectedColumns, name]
    )
  }

  const toggleAll = () => {
    if (selectedColumns.length === schema.length) {
      setSelectedColumns([])
    } else {
      setSelectedColumns(schema.map(f => f.name))
    }
  }

  // Drag to reorder
  const onDragStart = (e, name) => {
    setDragging(name)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e, name) => {
    e.preventDefault()
    setDragOver(name)
  }
  const onDrop = (e, name) => {
    e.preventDefault()
    if (!dragging || dragging === name) return
    const order = [...(columnOrder.length ? columnOrder : selectedColumns)]
    const fromIdx = order.indexOf(dragging)
    const toIdx = order.indexOf(name)
    if (fromIdx === -1 || toIdx === -1) return
    order.splice(fromIdx, 1)
    order.splice(toIdx, 0, dragging)
    setColumnOrder(order)
    setDragging(null)
    setDragOver(null)
  }

  const typeColors = {
    string: 'var(--text2)',
    integer: 'var(--accent)',
    float: '#F59E0B', // Amber for numbers
    boolean: 'var(--accent2)', // Pink
    date: 'var(--accent3)', // Emerald
  }

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Logo Section */}
      <div className="sidebar-logo">
        <div className="logo-icon">RS</div>
        <div className="logo-text">Reporting<span>System</span></div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { id: 'table', icon: <Table2 size={16} />, label: 'Data Explorer' },
          { id: 'charts', icon: <BarChart3 size={16} />, label: 'Visual Analytics' },
          { id: 'logs', icon: <Activity size={16} />, label: 'Audit Logs', admin: true },
        ].map(tab => {
          if (tab.admin && user?.role !== 'admin') return null
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', fontSize: '12px',
                fontWeight: active ? 600 : 500,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text2)',
                transition: 'all 0.2s',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
            >
              {tab.icon} <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Source Selector */}
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Source</div>
        <select 
          className="input" 
          style={{ fontSize: '12px', height: '34px', width: '100%', cursor: 'pointer', borderRadius: '6px' }}
          value={selectedSource || ''}
          onChange={handleSourceChange}
        >
          <option value="">All Sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Search */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
        <input
          className="input"
          placeholder="Filter..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: '11px', padding: '6px 10px', width: '100%', height: '32px' }}
        />
      </div>

      {/* Header actions */}
      <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Cols ({selectedColumns.length}/{schema.length})
        </span>
        <button
          onClick={toggleAll}
          style={{
            fontSize: '9px', fontWeight: 700, color: 'var(--accent)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '2px'
          }}
        >
          {selectedColumns.length === schema.length ? 'NONE' : 'ALL'}
        </button>
      </div>

      {/* Column List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {filtered.map(field => {
          const isSelected = selectedColumns.includes(field.name)
          const isOver = dragOver === field.name
          return (
            <div
              key={field.name}
              draggable
              onDragStart={e => onDragStart(e, field.name)}
              onDragOver={e => onDragOver(e, field.name)}
              onDrop={e => onDrop(e, field.name)}
              onDragEnd={() => { setDragging(null); setDragOver(null) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                marginBottom: 2,
                cursor: 'grab',
                background: isOver ? 'var(--bg3)' : 'transparent',
                border: isOver ? '1px dashed var(--accent)' : '1px solid transparent',
                opacity: dragging === field.name ? .4 : 1,
                transition: 'all .1s',
              }}
            >
              <GripVertical size={12} color="var(--text3)" style={{ flexShrink: 0 }} />

              {/* Type dot */}
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: typeColors[field.type] || '#888',
              }} />

              {/* Label */}
              <span
                onClick={() => toggleColumn(field.name)}
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: isSelected ? 'var(--text)' : 'var(--text3)',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 500 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={field.name}
              >
                {field.label}
              </span>

              {/* Toggle */}
              <button
                onClick={() => toggleColumn(field.name)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: isSelected ? 'var(--accent)' : 'var(--text3)' }}
              >
                {isSelected ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 12 }}>
            No columns found
          </div>
        )}
      </div>

      {/* Type Legend */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Object.entries(typeColors).map(([type, color]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  )
}
