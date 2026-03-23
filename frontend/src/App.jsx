import React, { useEffect } from 'react'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import FilterBuilder from './components/FilterBuilder'
import DataTable from './components/DataTable'
import ChartPanel from './components/ChartPanel'
import SavedViews from './components/SavedViews'
import Login from './components/Login'
import AuditLogs from './components/AuditLogs'
import './App.css'

export default function App() {
  const { 
    user, token, checkAuth, activeTab, sidebarOpen, fetchSchema, fetchSources, fetchViews, fetchReports 
  } = useStore()

  useEffect(() => {
    if (token) {
      checkAuth()
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchSchema()
      fetchSources()
      fetchViews()
      fetchReports()
    }
  }, [user])

  if (!user && token) {
     return <div className="loading-screen">Verifying session...</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className={`app-layout ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <div className="content-area">
          <FilterBuilder />

          {/* Results */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeTab === 'table' && <DataTable />}
            {activeTab === 'charts' && <ChartPanel />}
            {activeTab === 'logs' && <AuditLogs />}
          </div>
        </div>
      </div>

      {/* Saved Views Drawer */}
      <SavedViews />
    </div>
  )
}
