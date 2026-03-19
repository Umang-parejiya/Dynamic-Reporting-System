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
                      padding: '8px 12px', textAlign: 'center', fontWeight: 600,
                      color: g.label ? 'var(--text)' : 'transparent',
                      borderRight: '1px solid var(--border2)',
                    }}>
                      {g.label || ' '}
                    </th>
                  ))}
                </tr>
              )}
              <tr style={{ position: 'sticky', top: hasGroups ? 33 : 0, zIndex: 5 }}>
                {displayCols.map(col => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg2)',
                      borderBottom: '2px solid var(--border2)',
                      borderRight: '1px solid var(--border2)',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: sort.startsWith(col) ? 'var(--accent)' : 'var(--text2)',
                      userSelect: 'none',
                      position: 'relative',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                      onClick={() => handleSort(col)}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{getLabel(col)}</span>
                      {getSortIcon(col)}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={e => startResize(e, col)}
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 6, cursor: 'col-resize',
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
                    borderBottom: '1px solid var(--border)',
                    background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)'}
                >
                    {displayCols.map(col => {
                      // Ultra-Smart lookup: strip any existing suffix and try all variations
                      const baseName = col.replace(/(_s|_i|_f|_b|_dt|_txt)$/, '')
                      const variants = [baseName, baseName + '_f', baseName + '_i', baseName + '_s', baseName + '_dt', baseName + '_b', baseName + '_txt']
                      
                      let val = undefined
                      for (const v of variants) {
                        if (row[v] !== undefined && row[v] !== null) {
                          val = row[v]
                          break
                        }
                      }
                      
                      return (
                        <td
                          key={col}
                          style={{
                            padding: '8px 12px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: val == null ? 'var(--text3)' : 'var(--text)',
                            maxWidth: columnWidths[col] || 140,
                          }}
                          title={String(val ?? '')}
                        >
                          <CellValue value={val} col={col} schema={schema} />
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

function CellValue({ value, col, schema }) {
  if (value == null) return <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>—</span>
  
  const fieldSchema = schema.find(s => s.name === col || s.name === col + '_f' || s.name === col + '_i' || s.name === col + '_s')
  const isFloat = fieldSchema?.type === 'float' || col.toLowerCase().includes('price')

  if (typeof value === 'boolean') {
    return (
      <span className={`badge ${value ? 'badge-success' : 'badge-error'}`}>
        {value ? 'true' : 'false'}
      </span>
    )
  }
  
  if (col.endsWith('_dt') || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/))) {
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
      {new Date(value).toLocaleDateString()}
    </span>
  }

  // Handle numbers and numeric strings
  const num = typeof value === 'number' ? value : (is_numeric(value) ? parseFloat(value) : null)
  
  if (num !== null) {
    return <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent3)' }}>
      {isFloat 
        ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : num.toLocaleString()
      }
    </span>
  }
  
  return <span>{String(value)}</span>
}

function is_numeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function CompareView({ compareResult, displayCols, getLabel }) {
  const { current, compare, difference } = compareResult
  const pct = difference?.percentage
  const pctColor = pct > 0 ? 'var(--success)' : pct < 0 ? 'var(--error)' : 'var(--text2)'

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* Summary Banner */}
      <div style={{
        display: 'flex', gap: 16, padding: '14px 20px',
        background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
      }}>
        <StatCard label="Current Period" value={current.total.toLocaleString()} color="var(--accent)" />
        <StatCard label="Compare Period" value={compare.total.toLocaleString()} color="var(--text2)" />
        <StatCard
          label="Change"
          value={`${pct > 0 ? '+' : ''}${pct ?? '—'}%`}
          sub={`${difference.absolute > 0 ? '+' : ''}${difference.absolute} records`}
          color={pctColor}
        />
      </div>

      {/* Side by side tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
        {[
          { label: 'Current Period', docs: current.docs, accent: 'var(--accent)' },
          { label: 'Compare Period', docs: compare.docs, accent: 'var(--text2)' },
        ].map(({ label, docs, accent }) => (
          <div key={label} style={{ background: 'var(--bg)', overflow: 'auto' }}>
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: accent }}>
              {label}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {displayCols.slice(0, 4).map(col => (
                    <th key={col} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text2)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                      {getLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {displayCols.slice(0, 4).map(col => (
                      <td key={col} style={{ padding: '7px 12px', color: 'var(--text)' }}>
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

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function LoadingSkeleton({ cols }) {
  return (
    <div style={{ padding: '0 0' }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          display: 'flex', gap: 1,
          borderBottom: '1px solid var(--border)',
          padding: '10px 12px',
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
