import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import ColumnManager from './ColumnManager'

export default function DataTable() {
  const {
    results, total, loading, page, rows, setPage,
    selectedColumns, columnOrder, columnWidths, setColumnWidth,
    sort, setSort, schema, compareResult,
  } = useStore()

  const [resizing, setResizing] = useState(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const startX = useRef(0)
  const startW = useRef(0)
  const tableRef = useRef(null)

  // Load prefs on mount
  useEffect(() => {
    useStore.getState().loadColumnPreferences()
  }, [])

  // Ordered visible columns
  const orderedCols = columnOrder.length
    ? columnOrder.filter(c => selectedColumns.includes(c))
    : selectedColumns

  const displayCols = orderedCols.length
    ? orderedCols
    : schema.length
      ? schema.map(f => f.name)
      : []

  const getLabel = (name) => {
    const f = schema.find(s => s.name === name)
    return f?.label || name.replace(/(_s|_i|_f|_b|_dt)$/, '').replace(/_/g, ' ')
  }

  // Column Groupings Demo logic
  const columnGroups = {
    'Pricing': ['price_f', 'cost_f', 'margin_f', 'discount_f'],
    'Inventory': ['stock_i', 'reorder_level_i', 'warehouse_s'],
  }
  const reversedGroups = {}
  Object.entries(columnGroups).forEach(([g, cols]) => {
    cols.forEach(c => reversedGroups[c] = g)
  })

  // Build top-header groupings
  const buildGroupedHeaders = () => {
    if (!displayCols.length) return []
    const groups = []
    let currentGroup = reversedGroups[displayCols[0]] || null
    let count = 0

    displayCols.forEach(col => {
      const group = reversedGroups[col] || null
      if (group === currentGroup) {
        count++
      } else {
        groups.push({ label: currentGroup, span: count })
        currentGroup = group
        count = 1
      }
    })
    if (count > 0) groups.push({ label: currentGroup, span: count })
    return groups
  }
  const topGroups = buildGroupedHeaders()
  const hasGroups = topGroups.some(g => g.label !== null)

  // Column resizing
  const startResize = useCallback((e, col) => {
    e.preventDefault()
    setResizing(col)
    startX.current = e.clientX
    startW.current = columnWidths[col] || 140

    const onMove = (ev) => {
      const delta = ev.clientX - startX.current
      const newW = Math.max(60, startW.current + delta)
      setColumnWidth(col, newW)
    }
    const onUp = () => {
      setResizing(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [columnWidths, setColumnWidth])

  // Sort handler
  const handleSort = (col) => {
    const current = sort.startsWith(col) ? sort : ''
    if (!current) setSort(`${col} asc`)
    else if (current.endsWith('asc')) setSort(`${col} desc`)
    else setSort('score desc')
  }

  const getSortIcon = (col) => {
    if (!sort.startsWith(col)) return <ArrowUpDown size={11} style={{ opacity: .3 }} />
    if (sort.endsWith('asc')) return <ArrowUp size={11} style={{ color: 'var(--accent)' }} />
    return <ArrowDown size={11} style={{ color: 'var(--accent)' }} />
  }

  // Compare mode
  if (compareResult) {
    return <CompareView compareResult={compareResult} displayCols={displayCols} getLabel={getLabel} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ColumnManager open={columnsOpen} onClose={() => setColumnsOpen(false)} />
      
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }} ref={tableRef}>
        {loading ? (
          <LoadingSkeleton cols={displayCols.length || 6} />
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 12, tableLayout: 'fixed',
          }}>
            <colgroup>
              {displayCols.map(col => (
                <col key={col} style={{ width: columnWidths[col] || 140 }} />
              ))}
            </colgroup>
            <thead>
              {hasGroups && (
                <tr style={{ position: 'sticky', top: 0, zIndex: 6, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  {topGroups.map((g, i) => (
                    <th key={Math.random()} colSpan={g.span} style={{
                      padding: '10px 12px', textAlign: 'center', fontWeight: 700,
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: g.label ? 'var(--text)' : 'transparent',
                      borderRight: '1px solid var(--border)',
                      color: g.label ? '#475569' : 'transparent',
                      borderRight: '1px solid #e2e8f0',
                    }}>
                      {g.label || ' '}
                    </th>
                  ))}
                </tr>
              )}
              <tr style={{ position: 'sticky', top: hasGroups ? 35 : 0, zIndex: 5, background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {displayCols.map(col => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      position: 'relative',
                      width: columnWidths[col] || 140,
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => handleSort(col)}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{getLabel(col)}</span>
                      {sort.startsWith(col) && (
                        sort.endsWith('asc') ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setResizing(col) }}
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 4, cursor: 'col-resize',
                        background: resizing === col ? 'var(--accent)' : 'transparent',
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, ri) => (
                <tr
                  key={row.id || ri}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: ri % 2 === 0 ? '#fff' : '#f8fafc',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? '#fff' : '#f8fafc'}
                >
                    {displayCols.map(col => {
                      const base = col.replace(/(_s|_i|_f|_b|_dt|_txt)$/i, '').toLowerCase()
                      let val = row[col]
                      if (val === undefined || val === null) {
                        const bestKey = Object.keys(row).find(k => k.replace(/(_s|_i|_f|_b|_dt|_txt)$/i, '').toLowerCase() === base)
                        if (bestKey) val = row[bestKey]
                      }
                      
                      return (
                        <td
                          key={col}
                          style={{
                            padding: '10px 12px',
                            fontSize: 12,
                            color: val == null ? '#94a3b8' : '#1e293b',
                            maxWidth: columnWidths[col] || 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <CellValue value={val} col={col} schema={schema} isLight={true} />
                        </td>
                      )
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg2)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              Showing {((page - 1) * rows + 1).toLocaleString()}–{Math.min(page * rows, total).toLocaleString()} of {total.toLocaleString()}
            </span>
            <button className="btn btn-sm" onClick={() => setColumnsOpen(true)}>
              <Settings size={13} /> Manage Columns
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              className="btn btn-icon btn-sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, margin: '0 8px' }}>Page {page}</span>
            <button
              className="btn btn-icon btn-sm"
              onClick={() => setPage(page + 1)}
              disabled={page * rows >= total}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
function CellValue({ value, col, schema, isLight }) {
  if (value == null) return <span style={{ color: isLight ? '#94a3b8' : 'var(--text3)', fontStyle: 'italic' }}>—</span>
  
  const base = col.replace(/(_s|_i|_f|_b|_dt|_txt)$/i, '').toLowerCase()
  const fieldSchema = schema.find(s => {
    const sBase = s.name.replace(/(_s|_i|_f|_b|_dt|_txt)$/i, '').toLowerCase()
    return s.name === col || sBase === base
  })
  const isFloat = fieldSchema?.type === 'float' || col.toLowerCase().includes('price') || base.includes('price')

  if (typeof value === 'boolean') {
    return (
      <span style={{ 
        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: value ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        color: value ? '#059669' : '#dc2626',
        border: `1px solid ${value ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
      }}>
        {value ? 'TRUE' : 'FALSE'}
      </span>
    )
  }

  if (col.endsWith('_dt') || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/))) {
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isLight ? '#475569' : 'var(--text2)' }}>
      {new Date(value).toLocaleDateString()}
    </span>
  }

  if (is_numeric(value)) {
    const num = parseFloat(value)
    // If it's a price column, ALWAYS show 2 decimals (e.g. 500 -> 500.00)
    const isPrice = col.toLowerCase().includes('price') || fieldSchema?.type === 'float'
    
    return <span style={{ fontFamily: 'var(--font-mono)', color: isLight ? '#0369a1' : 'var(--accent3)', fontWeight: 600 }}>
      {isPrice 
        ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : num.toLocaleString()
      }
    </span>
  }
  
  return <span style={{ color: isLight ? '#1e293b' : 'var(--text)' }}>{String(value)}</span>
}

function is_numeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function CompareView({ compareResult, displayCols, getLabel }) {
  const { current, compare, difference } = compareResult
  const pct = difference?.percentage
  const pctColor = pct > 0 ? '#059669' : pct < 0 ? '#dc2626' : '#64748b'

  return (
    <div style={{ overflow: 'auto', height: '100%', background: '#f8fafc' }}>
      {/* Summary Banner */}
      <div style={{
        display: 'flex', gap: 16, padding: '14px 20px',
        background: '#fff', borderBottom: '1px solid #e2e8f0',
      }}>
        <StatCard label="Current Period" value={current.total.toLocaleString()} color="#5d5fef" isLight={true} />
        <StatCard label="Compare Period" value={compare.total.toLocaleString()} color="#64748b" isLight={true} />
        <StatCard
          label="Change"
          value={`${pct > 0 ? '+' : ''}${pct ?? '—'}%`}
          sub={`${difference.absolute > 0 ? '+' : ''}${difference.absolute} records`}
          color={pctColor}
          isLight={true}
        />
      </div>

      {/* Side by side tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e2e8f0' }}>
        {[
          { label: 'Current Period', docs: current.docs, accent: '#5d5fef' },
          { label: 'Compare Period', docs: compare.docs, accent: '#64748b' },
        ].map(({ label, docs, accent }) => (
          <div key={label} style={{ background: '#fff', overflow: 'auto' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: accent, background: '#f8fafc' }}>
              {label}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {displayCols.slice(0, 4).map(col => (
                    <th key={col} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, borderBottom: '1px solid #e2e8f0', fontSize: 11, textTransform: 'uppercase' }}>
                      {getLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    {displayCols.slice(0, 4).map(col => (
                      <td key={col} style={{ padding: '7px 12px', color: '#1e293b' }}>
                        {row[col] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, isLight }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 16px', minWidth: 140, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function LoadingSkeleton({ cols }) {
  return (
    <div style={{ background: '#fff' }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 1,
          borderBottom: '1px solid #f1f5f9',
          padding: '12px 12px',
          opacity: 1 - i * 0.1,
        }}>
          {[...Array(cols)].map((_, j) => (
            <div key={j} style={{
              flex: 1, height: 14,
              background: 'var(--bg3)',
              borderRadius: 4,
              animation: 'pulse 1.5s ease infinite',
              animationDelay: `${j * 0.05}s`,
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--text3)' }}>
      <div style={{
        fontSize: 32, color: 'var(--accent2)',
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)'
      }}>▲</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No results found</div>
      <div style={{ fontSize: 13 }}>Try adjusting your filters or indexing some CSV files</div>
    </div>
  )
}
