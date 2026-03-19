import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { Settings, X, GripVertical, Eye, EyeOff, Save, Check } from 'lucide-react'

export default function ColumnManager({ open, onClose }) {
  const {
    schema, selectedColumns, columnOrder, columnWidths,
    setSelectedColumns, setColumnOrder, saveColumnPreferences
  } = useStore()

  const [localOrder, setLocalOrder] = useState([])
  const [localSelected, setLocalSelected] = useState(new Set())
  const [draggedIdx, setDraggedIdx] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalOrder(columnOrder.length ? columnOrder : schema.map(f => f.name))
      setLocalSelected(new Set(selectedColumns))
    }
  }, [open, columnOrder, selectedColumns, schema])

  if (!open) return null

  const handleDragStart = (e, idx) => {
    setDraggedIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return

    const newOrder = [...localOrder]
    const item = newOrder.splice(draggedIdx, 1)[0]
    newOrder.splice(idx, 0, item)

    setLocalOrder(newOrder)
    setDraggedIdx(idx)
  }

  const handleDrop = () => {
    setDraggedIdx(null)
  }

  const toggleColumn = (name) => {
    const newSel = new Set(localSelected)
    if (newSel.has(name)) newSel.delete(name)
    else newSel.add(name)
    setLocalSelected(newSel)
  }

  const applyChanges = () => {
    setColumnOrder(localOrder)
    setSelectedColumns(Array.from(localSelected))
  }

  const handleSavePreferences = async () => {
    setSaving(true)
    applyChanges()
    // Wait for store to update, then save to server
    setTimeout(async () => {
      await saveColumnPreferences()
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 100)
  }

  const activeCount = localSelected.size

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.2)' }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 340, background: 'var(--bg2)',
        borderLeft: '1px solid var(--border)', zIndex: 151,
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow)',
        animation: 'slideInRight 0.2s ease',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Manage Columns</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {activeCount} of {schema.length} selected
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setLocalSelected(new Set(schema.map(f => f.name)))}>All</button>
            <button className="btn btn-sm" onClick={() => setLocalSelected(new Set())}>None</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {localOrder.map((colName, idx) => {
            const field = schema.find(f => f.name === colName)
            if (!field) return null
            const isSelected = localSelected.has(colName)

            return (
              <div
                key={colName}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={handleDrop}
                onDragEnd={handleDrop}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'var(--bg3)',
                  border: '1px solid var(--border2)', borderRadius: 6,
                  marginBottom: 6, opacity: isSelected ? 1 : 0.6,
                  cursor: 'grab',
                }}
              >
                <div style={{ color: 'var(--text3)', display: 'flex', alignItems: 'center', cursor: 'grab' }}>
                  <GripVertical size={14} />
                </div>
                <button
                  onClick={() => toggleColumn(colName)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: isSelected ? 'var(--accent)' : 'var(--text3)',
                    padding: 0, display: 'flex', alignItems: 'center',
                  }}
                >
                  {isSelected ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {field.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {columnWidths[colName] ? `${columnWidths[colName]}px` : ''}
                </div>
              </div>
            )
          })}
        </div>
        
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={applyChanges}>
            Apply Temporarily
          </button>
          <button 
            className={`btn ${saved ? '' : 'btn-primary'}`} 
            style={{ flex: 1, ...(saved ? { background: 'var(--success)', borderColor: 'var(--success)', color: '#fff' } : {}) }}
            onClick={handleSavePreferences}
            disabled={saving}
          >
            {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Default</>}
          </button>
        </div>
      </div>
    </>
  )
}
