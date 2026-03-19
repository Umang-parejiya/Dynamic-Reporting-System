import React, { useState } from 'react'
import { useStore } from '../store'
import { Plus, X, ChevronDown, Calendar, Search, ToggleLeft, Hash, List, GitMerge, FolderPlus } from 'lucide-react'

const FILTER_TYPES = [
  { value: 'text',         label: 'Text Search',   icon: <Search size={12} /> },
  { value: 'multi_select', label: 'Multi Select',  icon: <List size={12} /> },
  { value: 'range',        label: 'Number Range',  icon: <Hash size={12} /> },
  { value: 'date_range',   label: 'Date Range',    icon: <Calendar size={12} /> },
  { value: 'boolean',      label: 'Boolean',       icon: <ToggleLeft size={12} /> },
]

const defaultRule = () => ({ field: '', type: 'text', value: '' })
const defaultGroup = () => ({ type: 'nested', op: 'AND', children: [defaultRule()] })

export default function FilterBuilder() {
  const {
    filters, clearFilters,
    query, schema, facets, fetchFacets,
    dateRange, setDateRange, dateCompare, setDateCompare,
  } = useStore()

  const setFilters = (newFilters) => useStore.setState({ filters: newFilters })

  const [expanded, setExpanded] = useState(true)
  const [compareMode, setCompareMode] = useState(false)

  const handleRun = () => {
    if (compareMode && dateRange.from && dateRange.to) {
      useStore.getState().setDateCompare({
        field: 'ingested_at_dt',
        type: 'previous_period',
        from: dateRange.from,
        to: dateRange.to,
      })
    } else {
      useStore.getState().setDateCompare(null)
    }
    query(1)
  }

  const addRootRule = () => setFilters([...filters, defaultRule()])
  const addRootGroup = () => setFilters([...filters, defaultGroup()])

  const activeCount = filters.length

  return (
    <div className="card" style={{ flexShrink: 0 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown size={16} style={{ color: 'var(--text2)', transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Query Builder</span>
        {activeCount > 0 && <span className="badge badge-accent">{activeCount} active</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={addRootRule}><Plus size={13} /> Add Rule</button>
          <button className="btn btn-sm" onClick={addRootGroup}><FolderPlus size={13} /> Add Group</button>
          {filters.length > 0 && <button className="btn btn-sm btn-danger" onClick={clearFilters}>Clear</button>}
          <button className="btn btn-sm btn-primary" onClick={handleRun}>Run Query</button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 14px' }}>
          {/* Date Range Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Calendar size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>Global Date Filter</span>
            <input type="date" className="input" style={{ width: 140, fontSize: 12 }} value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} />
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>to</span>
            <input type="date" className="input" style={{ width: 140, fontSize: 12 }} value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} />
            
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', marginLeft: 10 }}>
              <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <GitMerge size={13} /> Compare
            </label>
            {compareMode && (
              <select className="input" style={{ width: 160, fontSize: 12 }} value={dateCompare?.type || 'previous_period'} onChange={e => setDateCompare({ ...(dateCompare || {}), type: e.target.value })}>
                <option value="previous_period">vs Previous Period</option>
                <option value="same_period_last_year">vs Last Year</option>
              </select>
            )}
          </div>

          {/* Root Group (Implicit AND over all top-level filters) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filters.map((node, idx) => (
              <FilterNode
                key={idx}
                node={node}
                isRoot={true}
                idx={idx}
                schema={schema}
                facets={facets}
                fetchFacets={fetchFacets}
                updateNode={(newNode) => {
                  const newF = [...filters]
                  newF[idx] = newNode
                  setFilters(newF)
                }}
                removeNode={() => {
                  const newF = [...filters]
                  newF.splice(idx, 1)
                  setFilters(newF)
                }}
              />
            ))}
          </div>

          {filters.length === 0 && (
            <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text3)', fontSize: 12, border: '1px dashed var(--border2)', borderRadius: 8 }}>
              No filters — <button onClick={addRootRule} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>Add one</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FilterNode({ node, isRoot, idx, schema, facets, fetchFacets, updateNode, removeNode }) {
  if (node.type === 'nested') {
    return (
      <div style={{
        padding: '10px', background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)', borderRadius: 8,
        marginLeft: isRoot ? 0 : 20, position: 'relative'
      }}>
        {/* Connector Line for nested items */}
        {!isRoot && <div style={{ position: 'absolute', left: -20, top: 16, width: 20, borderTop: '1px solid var(--border)' }} />}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <select
            className="input"
            style={{ width: 70, fontSize: 11, padding: '4px 6px', fontWeight: 'bold' }}
            value={node.op}
            onChange={e => updateNode({ ...node, op: e.target.value })}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Group</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => updateNode({ ...node, children: [...node.children, defaultRule()] })}><Plus size={12} /> Rule</button>
          <button className="btn btn-sm" onClick={() => updateNode({ ...node, children: [...node.children, defaultGroup()] })}><FolderPlus size={12} /> Group</button>
          <button onClick={removeNode} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 4 }}><X size={14} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {node.children.map((child, cIdx) => (
            <FilterNode
              key={cIdx}
              node={child}
              isRoot={false}
              idx={cIdx}
              schema={schema}
              facets={facets}
              fetchFacets={fetchFacets}
              updateNode={(newChild) => {
                const newC = [...node.children]
                newC[cIdx] = newChild
                updateNode({ ...node, children: newC })
              }}
              removeNode={() => {
                const newC = [...node.children]
                newC.splice(cIdx, 1)
                updateNode({ ...node, children: newC })
              }}
            />
          ))}
          {node.children.length === 0 && <div style={{ fontSize: 11, color: 'var(--text3)', padding: 4 }}>Empty group</div>}
        </div>
      </div>
    )
  }

  // Rule Node
  const facetOptions = node.field && facets[node.field] ? facets[node.field] : []

  const onFieldChange = (field) => {
    const fieldSchema = schema.find(s => s.name === field)
    let type = 'text'
    if (fieldSchema) {
      if (fieldSchema.type === 'integer' || fieldSchema.type === 'float') type = 'range'
      else if (fieldSchema.type === 'date') type = 'date_range'
      else if (fieldSchema.type === 'boolean') type = 'boolean'
    }
    updateNode({ ...node, field, type, value: '' })
    if (type === 'text' || type === 'multi_select') {
      fetchFacets([field])
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8,
      marginLeft: isRoot ? 0 : 20, position: 'relative'
    }}>
      {!isRoot && <div style={{ position: 'absolute', left: -20, top: 16, width: 20, borderTop: '1px solid var(--border2)' }} />}
      
      {/* Root level connector */}
      {isRoot && idx > 0 && <span style={{ width: 40, fontSize: 11, color: 'var(--text3)', textAlign: 'center', fontWeight: 'bold' }}>AND</span>}

      <select className="input" style={{ width: 160, fontSize: 12 }} value={node.field} onChange={e => onFieldChange(e.target.value)}>
        <option value="">Select field...</option>
        {schema.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
      </select>

      <select className="input" style={{ width: 130, fontSize: 12 }} value={node.type} onChange={e => updateNode({ ...node, type: e.target.value, value: '' })}>
        {FILTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <FilterValue
        filter={node}
        schema={schema}
        facetOptions={facetOptions}
        onChange={(val) => updateNode({ ...node, value: val })}
        onMinChange={(min) => updateNode({ ...node, min })}
        onMaxChange={(max) => updateNode({ ...node, max })}
        onFromChange={(from) => updateNode({ ...node, from })}
        onToChange={(to) => updateNode({ ...node, to })}
      />

      <button onClick={removeNode} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}><X size={14} /></button>
    </div>
  )
}

function FilterValue({ filter, schema, facetOptions, onChange, onMinChange, onMaxChange, onFromChange, onToChange }) {
  const inputStyle = { fontSize: 12, width: '100%' }
  const listId = `facets-${filter.field}`

  switch (filter.type) {
    case 'range':
      return (
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <input className="input" type="number" placeholder="Min" style={inputStyle} value={filter.min || ''} onChange={e => onMinChange(e.target.value)} />
          <span style={{ color: 'var(--text3)', alignSelf: 'center', fontSize: 12 }}>–</span>
          <input className="input" type="number" placeholder="Max" style={inputStyle} value={filter.max || ''} onChange={e => onMaxChange(e.target.value)} />
        </div>
      )
    case 'date_range':
      return (
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <input className="input" type="date" style={inputStyle} value={filter.from || ''} onChange={e => onFromChange(e.target.value)} />
          <span style={{ color: 'var(--text3)', alignSelf: 'center', fontSize: 12 }}>–</span>
          <input className="input" type="date" style={inputStyle} value={filter.to || ''} onChange={e => onToChange(e.target.value)} />
        </div>
      )
    case 'boolean':
      return (
        <select className="input" style={{ ...inputStyle, flex: 1 }} value={filter.value} onChange={e => onChange(e.target.value === 'true')}>
          <option value="">Select...</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      )
    case 'multi_select':
      return (
        <select className="input" style={{ ...inputStyle, flex: 1 }} multiple value={Array.isArray(filter.value) ? filter.value : []} onChange={e => onChange(Array.from(e.target.selectedOptions, o => o.value))} size={Math.min(4, facetOptions.length || 3)}>
          {facetOptions.length > 0
            ? facetOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.value} ({opt.count})</option>)
            : <option disabled>Load facets first...</option>
          }
        </select>
      )
    default: // text
      const fieldSchema = schema.find(s => s.name === filter.field)
      const isNumeric = fieldSchema && (fieldSchema.type === 'integer' || fieldSchema.type === 'float')
      
      return (
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            className="input"
            type={isNumeric ? 'number' : 'text'}
            style={{ ...inputStyle }}
            placeholder={isNumeric ? "Search number..." : "Search value..."}
            value={filter.value || ''}
            onChange={e => onChange(e.target.value)}
            list={listId}
          />
          <datalist id={listId}>
            {facetOptions.map(opt => <option key={opt.value} value={opt.value} />)}
          </datalist>
        </div>
      )
  }
}
