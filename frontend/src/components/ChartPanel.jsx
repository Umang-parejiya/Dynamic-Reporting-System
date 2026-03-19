import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { BarChart2, TrendingUp, PieChart as PieIcon, Download } from 'lucide-react'

const COLORS = ['#2b6cb0', '#3182ce', '#63b3ed', '#4fd1c5', '#38b2ac', '#81e6d9', '#a0aec0', '#718096']

const CHART_TYPES = [
  { id: 'bar',  label: 'Bar',  icon: <BarChart2 size={14} /> },
  { id: 'line', label: 'Line', icon: <TrendingUp size={14} /> },
  { id: 'pie',  label: 'Pie',  icon: <PieIcon size={14} /> },
  { id: 'composed', label: 'Multi-Axis', icon: <BarChart2 size={14} /> },
]

export default function ChartPanel() {
  const { schema, selectedColumns, filters, fetchChartAggregations, chartData } = useStore()
  const [chartType, setChartType] = useState('bar')
  
  const numericFields = schema.filter(f => f.type === 'integer' || f.type === 'float')
  const stringFields  = schema.filter(f => f.type === 'string')

  const [xField, setXField] = useState(stringFields[0]?.name || selectedColumns[0] || '')
  const [yField, setYField] = useState(numericFields[0]?.name || '')
  const [y2Field, setY2Field] = useState('')

  const chartRef = useRef(null)

  useEffect(() => {
    if (xField) {
      const yFields = []
      if (yField) yFields.push(yField)
      if (y2Field && chartType === 'composed') yFields.push(y2Field)
      fetchChartAggregations(xField, yFields)
    }
  }, [xField, yField, y2Field, chartType, filters, fetchChartAggregations])

  const getLabel = (name) => {
    const f = schema.find(s => s.name === name)
    return f?.label || name.replace(/(_s|_i|_f|_b|_dt)$/, '').replace(/_/g, ' ')
  }

  // Drill-down: clicking chart bar applies filter
  const handleChartClick = (data) => {
    if (!data) return
    let name = ''
    if (data.activePayload?.[0]) name = data.activePayload[0].payload.val
    else if (data.name) name = data.name

    if (name) {
      const filtersArr = useStore.getState().filters
      useStore.setState({
        filters: [...filtersArr, { field: xField, type: 'text', value: name }]
      })
      useStore.getState().query(1)
    }
  }

  const exportChartImage = () => {
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.download = `chart_${Date.now()}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const yKey = yField ? `${yField}_sum` : 'count'
  const yLabel = yField ? getLabel(yField) : 'Count'
  const y2Key = y2Field ? `${y2Field}_sum` : 'count'
  const y2Label = y2Field ? getLabel(y2Field) : 'Secondary Count'

  const tooltipStyle = {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', fontSize: 12, boxShadow: 'var(--shadow-sm)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, flexWrap: 'wrap' }}>
        
        <div style={{ display: 'flex', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 999, padding: 2, overflow: 'hidden' }}>
          {CHART_TYPES.map(t => (
            <button
              key={t.id} onClick={() => setChartType(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, background: chartType === t.id ? 'var(--bg2)' : 'transparent',
                color: chartType === t.id ? 'var(--accent)' : 'var(--text2)', borderRadius: 999, boxShadow: chartType === t.id ? 'var(--shadow-sm)' : 'none', transition: 'all .15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>X-Axis:</span>
          <select className="input" style={{ width: 140, fontSize: 12, padding: '6px 14px' }} value={xField} onChange={e => setXField(e.target.value)}>
            {schema.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
          </select>
        </div>

        {chartType !== 'pie' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Y-Axis:</span>
            <select className="input" style={{ width: 140, fontSize: 12, padding: '6px 14px' }} value={yField} onChange={e => setYField(e.target.value)}>
              <option value="">Count</option>
              {numericFields.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
            </select>
          </div>
        )}

        {chartType === 'composed' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Y-Axis 2:</span>
            <select className="input" style={{ width: 140, fontSize: 12, padding: '6px 14px', borderColor: 'var(--accent)' }} value={y2Field} onChange={e => setY2Field(e.target.value)}>
              <option value="">None</option>
              {numericFields.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Click to drill-down</span>
        <button className="btn btn-sm" onClick={exportChartImage} style={{ gap: 5 }}><Download size={13} /> Export PNG</button>
      </div>

      {/* Chart Area */}
      <div style={{ flex: 1, padding: '30px 40px', overflow: 'hidden', background: 'var(--bg)' }} ref={chartRef}>
        {chartData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
            No data to display. Add filters or verify schema.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'composed' ? (
              <ComposedChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="val" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--accent)', fontSize: 11 }} axisLine={false} tickLine={false} dx={10} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg3)', opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)', paddingTop: 20 }} />
                <Bar yAxisId="left" dataKey={yKey} name={yLabel} radius={[4, 4, 0, 0]} barSize={40} fill="var(--accent2)" />
                {y2Field && <Line yAxisId="right" type="monotone" dataKey={y2Key} name={y2Label} stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} />}
              </ComposedChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="val" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)', paddingTop: 20 }} />
                <Line type="monotone" dataKey={yKey} name={yLabel} stroke="var(--accent)" strokeWidth={3} activeDot={{ r: 6 }} />
              </LineChart>
            ) : chartType === 'pie' ? (
              <PieChart>
                <Pie data={chartData} dataKey={yKey} nameKey="val" cx="50%" cy="50%" outerRadius="75%" innerRadius="40%" paddingAngle={2}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--bg)" strokeWidth={3} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)' }} verticalAlign="bottom" height={36}/>
              </PieChart>
            ) : (
              <BarChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="val" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg3)', opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)', paddingTop: 20 }} />
                <Bar dataKey={yKey} name={yLabel} radius={[4, 4, 0, 0]} barSize={40}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, padding: '10px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <Stat label="Data Points" value={chartData.length} />
        <Stat label="Total Volume" value={chartData.reduce((s, d) => s + (d[yKey] || 0), 0).toLocaleString()} />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}
