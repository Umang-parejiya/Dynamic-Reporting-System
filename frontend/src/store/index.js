import { create } from 'zustand'

const API = '/api'

export const useStore = create((set, get) => ({
   // ── Auth & User ──────────────────────────────────────────────────
  user: null,
  token: localStorage.getItem('token') || null,
  authLoading: false,

  login: async (email, password) => {
    set({ authLoading: true })
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('token', data.user.token)
        set({ user: data.user, token: data.user.token })
        get().fetchSchema()
        get().loadColumnPreferences()
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (e) {
      return { success: false, error: 'Connection failed' }
    } finally {
      set({ authLoading: false })
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, results: [], total: 0 })
  },

  checkAuth: async () => {
    const token = get().token
    if (!token) return
    try {
      const res = await fetch(`${API}/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user })
        get().loadColumnPreferences()
      } else {
        get().logout()
      }
    } catch (e) {
      get().logout()
    }
  },

  // ── Schema ────────────────────────────────────────────────────────
  schema: [],
  schemaLoading: false,
  sources: [],
  selectedSource: null,
  fetchSchema: async (source) => {
    set({ schemaLoading: true, selectedSource: source || null })
    try {
      const url = source ? `${API}/schema?source=${encodeURIComponent(source)}` : `${API}/schema`
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${get().token}` }
      })
      const data = await res.json()
      set({ schema: data.fields || [] })
      get().query(1)
    } catch (e) {
      console.error('Schema fetch failed', e)
    } finally {
      set({ schemaLoading: false })
    }
  },
  fetchSources: async () => {
    try {
      const res = await fetch(`${API}/sources`, {
        headers: { 'Authorization': `Bearer ${get().token}` }
      })
      const data = await res.json()
      set({ sources: data.sources || [] })
    } catch (e) {
      console.error('Sources fetch failed', e)
    }
  },

  // ── Column Config ─────────────────────────────────────────────────
  selectedColumns: [],
  columnWidths: {},
  columnOrder: [],
  setSelectedColumns: (cols) => set({ selectedColumns: cols }),
  setColumnOrder: (order) => set({ columnOrder: order }),
  setColumnWidth: (col, width) =>
    set(s => ({ columnWidths: { ...s.columnWidths, [col]: width } })),
  initColumns: (schema) => {
    const cols = schema.slice(0, 8).map(f => f.name)
    set({ selectedColumns: cols, columnOrder: cols })
  },
  saveColumnPreferences: async () => {
    const s = get()
    await fetch(`${API}/column-config`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.token}`
      },
      body: JSON.stringify({
        column_config: {
          widths: s.columnWidths,
          order: s.columnOrder,
          selected: s.selectedColumns,
        }
      })
    })
  },
  loadColumnPreferences: async () => {
    try {
      const res = await fetch(`${API}/column-config`, {
        headers: { 'Authorization': `Bearer ${get().token}` }
      })
      const data = await res.json()
      if (data.column_config && data.column_config.order) {
        set({
          columnWidths: data.column_config.widths || {},
          columnOrder: data.column_config.order || [],
          selectedColumns: data.column_config.selected || [],
        })
        return true
      }
    } catch (e) { }
    return false
  },

  // ── Filters ───────────────────────────────────────────────────────
  filters: [],
  addFilter: (filter) => set(s => ({ filters: [...s.filters, filter] })),
  updateFilter: (idx, filter) => set(s => ({
    filters: s.filters.map((f, i) => i === idx ? { ...f, ...filter } : f)
  })),
  removeFilter: (idx) => set(s => ({
    filters: s.filters.filter((_, i) => i !== idx)
  })),
  clearFilters: () => set({ filters: [] }),

  // ── Date ──────────────────────────────────────────────────────────
  dateRange: { from: '', to: '' },
  dateField: 'ingested_at_dt',
  dateCompare: null,
  setDateRange: (dr) => set({ dateRange: dr }),
  setDateField: (df) => set({ dateField: df }),
  setDateCompare: (dc) => set({ dateCompare: dc }),

  // ── Query / Results ───────────────────────────────────────────────
  results: [],
  total: 0,
  page: 1,
  rows: 50,
  sort: 'score desc',
  loading: false,
  compareResult: null,
  cursorHistory: ['*'],
  setPage: (page) => { get().query(page) },
  setRows: (rows) => { set({ rows, page: 1, cursorHistory: ['*'] }); get().query(1) },
  setSort: (sort) => { set({ sort, page: 1, cursorHistory: ['*'] }); get().query(1) },

  query: async (targetPage) => {
    const s = get()
    const page = targetPage || s.page
    set({ loading: true, compareResult: null, page })

    const activeFilters = s.filters.filter(f => {
      if (f.type === 'nested') return (f.children && f.children.length > 0)
      if (!f.field) return false
      if (f.type === 'range') return f.min || f.max || (f.value !== '' && f.value != null)
      if (f.type === 'date_range') return f.from || f.to
      if (Array.isArray(f.value)) return f.value.length > 0
      return f.value !== '' && f.value != null
    })

    if (s.selectedSource) {
      activeFilters.push({ field: 'source_file_s', type: 'text', value: s.selectedSource })
    }

    const body = {
      rows: s.rows,
      cursor: s.cursorHistory[page - 1] || '*',
      sort: s.sort,
      fields: s.selectedColumns.length 
        ? [...new Set(s.selectedColumns.flatMap(c => {
            const base = c.replace(/(_s|_i|_f|_b|_dt|_txt)$/i, '')
            return [c, base, base + '_s', base + '_i', base + '_f', base + '_dt', base + '_b', base + '_txt']
          }))].filter(f => f)
        : ['*'],
      filters: activeFilters,
      dateRange: s.dateRange,
      dateField: s.dateField,
      dateCompare: s.dateCompare,
    }

    try {
      const res = await fetch(`${API}/query`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.token}`
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.current) {
        // Date compare mode
        set({
          results: data.current.docs || [],
          total: data.current.total || 0,
          compareResult: data,
        })
      } else {
        set({ results: data.docs || [], total: data.total || 0 })
        if (data.nextCursorMark) {
          set(state => {
            const h = [...state.cursorHistory]
            h[page] = data.nextCursorMark
            return { cursorHistory: h }
          })
        }
      }
    } catch (e) {
      console.error('Query failed', e)
    } finally {
      set({ loading: false })
    }
  },

  // ── Facets & Aggs ────────────────────────────────────────────────
  facets: {},
  fetchFacets: async (fields) => {
    if (!fields.length) return
    try {
      const res = await fetch(`${API}/facets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get().token}`
        },
        body: JSON.stringify({ fields, limit: 100 }),
      })
      const data = await res.json()
      set(s => ({ facets: { ...s.facets, ...(data.facets || {}) } }))
    } catch (e) {
      console.error('Facets failed', e)
    }
  },

  chartData: [],
  fetchChartAggregations: async (xField, yFields = []) => {
    const s = get()
    if (!xField) {
      set({ chartData: [] })
      return
    }
    set({ loading: true })
    const activeFilters = s.filters.filter(f => {
      if (f.type === 'nested') return true
      if (!f.field) return false
      if (f.type === 'range') return f.min || f.max
      if (f.type === 'date_range') return f.from || f.to
      if (Array.isArray(f.value)) return f.value.length > 0
      return f.value !== '' && f.value != null
    })

    // Construct metrics for all requested yFields
    const metrics = []
    if (yFields.length > 0) {
      yFields.forEach(f => {
        metrics.push({ type: 'sum', field: f })
        metrics.push({ type: 'avg', field: f })
      })
    } else {
      metrics.push({ type: 'count', field: '' })
    }

    try {
      const res = await fetch(`${API}/aggregations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get().token}`
        },
        body: JSON.stringify({
          q: '*:*',
          filters: activeFilters,
          groupBy: xField,
          metrics,
        })
      })
      const data = await res.json()
      set({ chartData: data.aggregations || [] })
    } catch (e) { } finally {
      set({ loading: false })
    }
  },

  // ── Saved Views ───────────────────────────────────────────────────
  views: [],
  fetchViews: async () => {
    try {
      const res = await fetch(`${API}/views`, {
        headers: { 'Authorization': `Bearer ${get().token}` }
      })
      const data = await res.json()
      set({ views: data.views || [] })
    } catch (e) { }
  },
  saveView: async (viewData) => {
    const s = get()
    await fetch(`${API}/views`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.token}`
      },
      body: JSON.stringify({
        ...viewData,
        columns: s.selectedColumns,
        filters: s.filters,
        sort: s.sort,
      }),
    })
    get().fetchViews()
  },
  loadView: (view) => {
    set({
      selectedColumns: view.columns || [],
      columnOrder: view.columns || [],
      filters: view.filters || [],
      sort: view.sort || 'score desc',
    })
    get().query()
  },
  deleteView: async (id) => {
    await fetch(`${API}/views`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${get().token}`
      },
      body: JSON.stringify({ id }),
    })
    get().fetchViews()
  },

  // ── Reports & Permissions ────────────────────────────────────────
  reports: [],
  auditLogs: [],
  fetchReports: async () => {
    try {
      const res = await fetch(`${API}/reports`, {
        headers: { 'Authorization': `Bearer ${get().token}` }
      })
      const data = await res.json()
      set({ reports: data.reports || [] })
    } catch (e) { }
  },
  saveReport: async (name) => {
    const s = get()
    try {
      const res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.token}`
        },
        body: JSON.stringify({
          name,
          columns: s.selectedColumns,
          filters: s.filters,
          sort: s.sort,
          date_range: s.dateRange
        }),
      })
      const data = await res.json()
      if (data.success) {
        get().fetchReports()
        return true
      }
    } catch (e) { }
    return false
  },
  deleteReport: async (id) => {
    try {
      const res = await fetch(`${API}/reports`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${get().token}`
        },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        get().fetchReports()
        return true
      }
    } catch (e) { }
    return false
  },
  fetchLogs: async () => {
    try {
      const res = await fetch(`${API}/logs`, {
        headers: { 'Authorization': `Bearer ${get().token}` }
      })
      const data = await res.json()
      set({ auditLogs: data.logs || [] })
    } catch (e) { }
  },

  // ── UI State ──────────────────────────────────────────────────────
  activeTab: 'table',   // table | charts | logs
  sidebarOpen: true,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}))
