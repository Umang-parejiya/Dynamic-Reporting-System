import React, { useEffect } from 'react'
import { useStore } from '../store'
import { Activity, User, Clock, Filter, PlusCircle, Trash2 } from 'lucide-react'

export default function AuditLogs() {
  const { auditLogs, fetchLogs, loading } = useStore()

  useEffect(() => {
    fetchLogs()
    const timer = setInterval(fetchLogs, 10000)
    return () => clearInterval(timer)
  }, [])

  const getIcon = (action) => {
    switch (action) {
      case 'report_created': return <PlusCircle size={14} color="#10b981" />
      case 'report_deleted': return <Trash2 size={14} color="#ef4444" />
      case 'filter_applied': return <Filter size={14} color="#3b82f6" />
      default: return <Activity size={14} color="var(--text3)" />
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, m: 0 }}>System Audit Logs</h2>
        <button className="btn btn-sm" onClick={fetchLogs}>Refresh</button>
      </div>

      <div style={{ 
        flex: 1, overflowY: 'auto', background: 'var(--bg2)', 
        borderRadius: 12, border: '1px solid var(--border2)' 
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg3)', zIndex: 1, borderBottom: '1px solid var(--border2)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 16px' }}>Action</th>
              <th style={{ textAlign: 'left', padding: '12px 16px' }}>User</th>
              <th style={{ textAlign: 'left', padding: '12px 16px' }}>Details</th>
              <th style={{ textAlign: 'left', padding: '12px 16px' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border3)' }}>
                <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getIcon(log.action)}
                  <span style={{ textTransform: 'capitalize' }}>{log.action.replace('_', ' ')}</span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={12} /> {log.user_id}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {JSON.stringify(log.data)}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} /> {new Date(log.timestamp).toLocaleString()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
