'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm, UseFormRegister, Path, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { Location } from '@/types/location'
import { Trash2, Edit, Check, X, Activity, MapPin, AlertTriangle, FileText, Search, Filter } from 'lucide-react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['TOILET', 'ACCESSIBLE_TOILET', 'NURSING_ROOM']),
  lat: z.number(),
  lng: z.number(),
  floor: z.string().optional(),
  hasTissue: z.boolean(),
  hasDryer: z.boolean(),
  hasSeat: z.boolean(),
  hasDiaperTable: z.boolean(),
  hasWaterDispenser: z.boolean(),
  hasAutoDoor: z.boolean(),
  hasHandrail: z.boolean(),
})

type LocationFormData = z.infer<typeof locationSchema>

const NTU_CENTER = { lat: 25.0174, lng: 121.5397 }

interface DashboardStats {
  counts: {
    totalLocations: number
    pendingRequests: number
    pendingReports: number
    todayReviews: number
    todayActiveUsers: number
  }
  trends: {
    name: string
    reviews: number
    reports: number
  }[]
}

interface Report {
  id: string
  content: string
  status: 'PENDING' | 'RESOLVED'
  adminReply?: string
  createdAt: string
  location?: {
    name: string
  }
  user?: {
    name: string
    email: string
  }
}

interface Request {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  adminReply?: string
  createdAt: string
  data: LocationFormData
  user?: {
    name: string
  }
}

export default function DashboardClient() {
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'reports' | 'requests'>('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [locations, setLocations] = useState<Location[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [selectedPos, setSelectedPos] = useState<{ lat: number, lng: number } | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')

  // Reply state
  const [replyContent, setReplyContent] = useState<{ [key: string]: string }>({})

  const { register, handleSubmit, reset, setValue, control } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      type: 'TOILET',
      lat: NTU_CENTER.lat,
      lng: NTU_CENTER.lng,
      hasTissue: false,
      hasDryer: false,
      hasSeat: false,
      hasDiaperTable: false,
      hasWaterDispenser: false,
      hasAutoDoor: false,
      hasHandrail: false,
    }
  })

  const selectedType = useWatch({
    control,
    name: 'type',
    defaultValue: 'TOILET'
  })

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) setStats(await res.json())
    } catch (e) { console.error(e) }
    setIsLoading(false)
  }, [])

  const fetchLocations = useCallback(async () => {
    setIsLoading(true)
    try {
        const res = await fetch('/api/locations')
        if (res.ok) setLocations(await res.json())
    } catch (e) { console.error(e) }
    setIsLoading(false)
  }, [])

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
        const res = await fetch('/api/reports')
        if (res.ok) setReports(await res.json())
    } catch (e) { console.error(e) }
    setIsLoading(false)
  }, [])

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    try {
        const res = await fetch('/api/requests')
        if (res.ok) setRequests(await res.json())
    } catch (e) { console.error(e) }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // Initial fetch for overview
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [fetchStats])

  // Function to switch tab and reset filters (or set specific ones)
  const handleSwitchTab = (tab: 'overview' | 'locations' | 'reports' | 'requests', initialStatus: string = 'ALL') => {
      setActiveTab(tab)
      setSearchTerm('')
      setStatusFilter(initialStatus)
      setTypeFilter('ALL')
      
      // Fetch data based on the new tab
      if (tab === 'overview') fetchStats()
      if (tab === 'locations') fetchLocations()
      if (tab === 'reports') fetchReports()
      if (tab === 'requests') fetchRequests()
  }

  // Filter Logic
  const filteredLocations = useMemo(() => {
      return locations.filter(loc => {
          const matchesSearch = loc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              loc.description?.toLowerCase().includes(searchTerm.toLowerCase())
          const matchesType = typeFilter === 'ALL' || loc.type === typeFilter
          return matchesSearch && matchesType
      })
  }, [locations, searchTerm, typeFilter])

  const filteredReports = useMemo(() => {
      return reports.filter(report => {
          const matchesSearch = 
              report.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
              report.location?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              report.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
          
          const matchesStatus = statusFilter === 'ALL' || report.status === statusFilter
          return matchesSearch && matchesStatus
      })
  }, [reports, searchTerm, statusFilter])

  const filteredRequests = useMemo(() => {
      return requests.filter(req => {
          const matchesSearch = 
              req.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())
          
          const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter
          return matchesSearch && matchesStatus
      })
  }, [requests, searchTerm, statusFilter])

  const onSubmit = async (data: LocationFormData) => {
    const url = editingLocation 
        ? `/api/locations/${editingLocation.id}` 
        : '/api/locations'
    
    const method = editingLocation ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      reset()
      setSelectedPos(null)
      setEditingLocation(null)
      fetchLocations()
      toast.success(editingLocation ? 'Location updated successfully' : 'Location created successfully')
    } else {
        toast.error('Failed to save location')
    }
  }

  const handleEdit = (loc: Location) => {
      setEditingLocation(loc)
      setSelectedPos({ lat: loc.lat, lng: loc.lng })
      reset({
          name: loc.name,
          description: loc.description || '',
          type: loc.type,
          lat: loc.lat,
          lng: loc.lng,
          floor: loc.floor || '',
          hasTissue: loc.hasTissue,
          hasDryer: loc.hasDryer,
          hasSeat: loc.hasSeat,
          hasDiaperTable: loc.hasDiaperTable,
          hasWaterDispenser: loc.hasWaterDispenser,
          hasAutoDoor: loc.hasAutoDoor,
          hasHandrail: loc.hasHandrail,
      })
  }

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure?')) return
      const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
      if (res.ok) fetchLocations()
  }

  const handleReportAction = async (id: string, status: 'RESOLVED' | 'PENDING') => {
      const reply = replyContent[id] || ''
      const res = await fetch(`/api/reports`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, adminReply: reply })
      })
      if (res.ok) {
          fetchReports()
          setReplyContent(prev => ({ ...prev, [id]: '' })) // Clear reply input
          if (status === 'RESOLVED') toast.success('回報已解決')
      } else {
          toast.error('Failed to update report')
      }
  }

  const handleRequestAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
      const reply = replyContent[id] || ''
      const res = await fetch(`/api/requests`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, adminReply: reply })
      })
      if (res.ok) {
          fetchRequests()
          setReplyContent(prev => ({ ...prev, [id]: '' })) // Clear reply input
          if (status === 'APPROVED') toast.success('已核准並新增地點')
          else toast.success('已拒絕申請')
      } else {
          toast.error('Failed to update request')
      }
  }

  const handleMapClick = (e: google.maps.MapMouseEvent | any) => {
      if (e.latLng) {
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          setSelectedPos({ lat, lng })
          setValue('lat', lat)
          setValue('lng', lng)
      } else if (e.detail && e.detail.latLng) {
          const { lat, lng } = e.detail.latLng
          setSelectedPos({ lat, lng })
          setValue('lat', lat)
          setValue('lng', lng)
      }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <NavButton active={activeTab === 'overview'} onClick={() => handleSwitchTab('overview')}>總覽</NavButton>
              <NavButton active={activeTab === 'locations'} onClick={() => handleSwitchTab('locations')}>設施資訊</NavButton>
              <NavButton active={activeTab === 'reports'} onClick={() => handleSwitchTab('reports')}>問題回報</NavButton>
              <NavButton active={activeTab === 'requests'} onClick={() => handleSwitchTab('requests')}>地點申請</NavButton>
              <Link 
                href="/"
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium text-sm flex items-center"
              >
                回到首頁
              </Link>
          </div>
      </div>
      
      {/* Search and Filter Bar */}
      {activeTab !== 'overview' && (
          <div className="mb-6 p-4 bg-[#111827] rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                      type="text" 
                      placeholder="搜尋名稱、內容或使用者..." 
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              
              {activeTab === 'locations' && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                      <Filter className="text-black w-4 h-4" />
                      <select 
                          className="flex-1 md:w-48 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none text-black focus:border-blue-500 cursor-pointer"
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                      >
                          <option value="ALL">所有類型</option>
                          <option value="TOILET">一般廁所</option>
                          <option value="ACCESSIBLE_TOILET">無障礙廁所</option>
                          <option value="NURSING_ROOM">哺乳室</option>
                      </select>
                  </div>
              )}

              {(activeTab === 'reports' || activeTab === 'requests') && (
                   <div className="flex items-center gap-2 w-full md:w-auto">
                      <Filter className="text-gray-400 w-4 h-4" />
                      <select 
                          className="flex-1 md:w-48 px-3 py-2 bg-white border text-black border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                      >
                          <option value="ALL">所有狀態</option>
                          <option value="PENDING">待處理 (Pending)</option>
                          {activeTab === 'reports' ? (
                              <option value="RESOLVED">已解決 (Resolved)</option>
                          ) : (
                              <>
                                  <option value="APPROVED">已核准 (Approved)</option>
                                  <option value="REJECTED">已拒絕 (Rejected)</option>
                              </>
                          )}
                      </select>
                  </div>
              )}
          </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
          isLoading ? <SkeletonOverview /> : (
          stats && (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        title="總地點數" 
                        value={stats.counts.totalLocations} 
                        icon={<MapPin className="text-blue-500" />} 
                        color="blue"
                        onClick={() => handleSwitchTab('locations')}
                    />
                    <StatCard 
                        title="未解決回報" 
                        value={stats.counts.pendingReports} 
                        icon={<AlertTriangle className="text-red-500" />} 
                        color="red"
                        onClick={() => handleSwitchTab('reports', 'PENDING')}
                    />
                    <StatCard 
                        title="待審核申請" 
                        value={stats.counts.pendingRequests} 
                        icon={<FileText className="text-yellow-500" />} 
                        color="yellow"
                        onClick={() => handleSwitchTab('requests', 'PENDING')}
                    />
                    <StatCard 
                        title="今日活躍用戶" 
                        value={stats.counts.todayActiveUsers} 
                        icon={<Activity className="text-green-500" />} 
                        color="green"
                    />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6 text-gray-900">最近 7 天趨勢</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.trends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#FFF', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                />
                                <Line type="monotone" dataKey="reviews" name="新增評論" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFF' }} />
                                <Line type="monotone" dataKey="reports" name="回報問題" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, fill: '#EF4444', strokeWidth: 2, stroke: '#FFF' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
          )
        )
      )}

      {/* Locations Tab */}
      {activeTab === 'locations' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Form */}
            <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="bg-black rounded-2xl shadow-sm border border-white overflow-hidden sticky top-8">
                    <div className="p-6 border-b border-gray-100 bg-black">
                        <h2 className="text-lg font-bold text-white">{editingLocation ? '編輯地點' : '新增地點'}</h2>
                        <p className="text-sm text-white mt-1">請填寫以下資訊以{editingLocation ? '更新' : '建立'}設施。</p>
                    </div>
                    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-white mb-1.5">名稱</label>
                            <input {...register('name')} className="w-full p-2.5 bg-white border border-gray-200 text-black rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="例如：博雅教學館 1F 男廁" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">類型</label>
                                <select {...register('type')} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                                    <option value="TOILET">一般廁所</option>
                                    <option value="ACCESSIBLE_TOILET">無障礙廁所</option>
                                    <option value="NURSING_ROOM">哺乳室</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white mb-1.5">樓層</label>
                                <input {...register('floor')} className="w-full p-2.5 bg-white border text-black border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="例如：1F" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white mb-1.5">描述</label>
                            <textarea {...register('description')} rows={3} className="w-full p-2.5 text-black bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="關於此地點的更多細節..." />
                        </div>
                        
                        <div className="bg-black p-4 rounded-xl border border-gray-100">
                            <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-3">設施與功能</label>
                            <div className="space-y-2">
                                {selectedType === 'TOILET' && (
                                    <>
                                        <FacilityCheckbox id="hasTissue" label="提供衛生紙" icon="🧻" className="text-white" register={register} />
                                        <FacilityCheckbox id="hasDryer" label="烘手機" icon="💨" register={register} />
                                        <FacilityCheckbox id="hasSeat" label="坐式馬桶" icon="🚽" register={register} />
                                    </>
                                )}
                                {selectedType === 'NURSING_ROOM' && (
                                    <>
                                        <FacilityCheckbox id="hasDiaperTable" label="尿布檯" icon="👶" register={register} />
                                        <FacilityCheckbox id="hasWaterDispenser" label="飲水機" icon="💧" register={register} />
                                        <FacilityCheckbox id="hasAutoDoor" label="自動門" icon="🚪" register={register} />
                                    </>
                                )}
                                {selectedType === 'ACCESSIBLE_TOILET' && (
                                    <>
                                        <FacilityCheckbox id="hasTissue" label="提供衛生紙" icon="🧻" register={register} />
                                        <FacilityCheckbox id="hasDryer" label="烘手機" icon="💨" register={register} />
                                        <FacilityCheckbox id="hasHandrail" label="扶手" icon="🤲" register={register} />
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white mb-2">地圖位置</label>
                            <div className="h-[250px] w-full border border-gray-200 rounded-xl overflow-hidden relative shadow-inner">
                                <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                                    <Map
                                        defaultCenter={NTU_CENTER}
                                        defaultZoom={16}
                                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                                        onClick={handleMapClick}
                                        gestureHandling={'greedy'}
                                        disableDefaultUI={true}
                                    >
                                        {filteredLocations.map(loc => (
                                            <AdvancedMarker key={loc.id} position={{ lat: loc.lat, lng: loc.lng }}>
                                                <Pin background={'#9CA3AF'} scale={0.7} borderColor={'transparent'} glyphColor={'transparent'} />
                                            </AdvancedMarker>
                                        ))}
                                        {selectedPos && (
                                            <AdvancedMarker position={selectedPos}>
                                                <Pin background={'#3B82F6'} glyphColor={'#FFF'} borderColor={'#2563EB'} />
                                            </AdvancedMarker>
                                        )}
                                    </Map>
                                </APIProvider>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-right">
                                {selectedPos ? `已選取: ${selectedPos.lat.toFixed(6)}, ${selectedPos.lng.toFixed(6)}` : '點擊地圖選擇位置'}
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            {editingLocation && (
                                <button 
                                    type="button" 
                                    onClick={() => { setEditingLocation(null); reset(); setSelectedPos(null); }} 
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    取消
                                </button>
                            )}
                            <button 
                                type="submit" 
                                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
                            >
                                {editingLocation ? '更新地點' : '新增地點'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right Column: List */}
            <div className="lg:col-span-7 order-1 lg:order-2">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">現有地點列表</h2>
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                        共 {filteredLocations.length} 筆
                    </span>
                </div>
                
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                    </div>
                ) : (
                    <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar ">
                        {filteredLocations.length === 0 && (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-gray-400 text-sm">沒有找到符合的地點</p>
                            </div>
                        )}
                        {filteredLocations.map(loc => (
                            <div key={loc.id} className="group bg-[#111827] p-4 rounded-xl border border-gray-800 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-200 flex justify-between items-start ">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-white">{loc.name}</h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium 
                                            ${loc.type === 'TOILET' ? 'bg-blue-900/50 text-blue-100 border border-blue-800' : 
                                              loc.type === 'ACCESSIBLE_TOILET' ? 'bg-purple-900/50 text-purple-100 border border-purple-800' : 
                                              'bg-pink-900/50 text-pink-100 border border-pink-800'}`}>
                                            {loc.type === 'TOILET' ? '一般廁所' : loc.type === 'ACCESSIBLE_TOILET' ? '無障礙' : '哺乳室'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                                        {loc.floor || '未知樓層'}
                                    </p>
                                    {loc.description && <p className="text-xs text-gray-500 mt-2 line-clamp-1">{loc.description}</p>}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(loc)} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors" title="編輯">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(loc.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors" title="刪除">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
      )}

      {activeTab === 'reports' && (
          <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">Member Reports</h2>
                  <span className="text-sm text-white">{filteredReports.length} reports</span>
              </div>
              
              {isLoading ? (
                  <div className="space-y-4">
                      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                  </div>
              ) : (
                  <>
                    {filteredReports.length === 0 && <EmptyState message="No reports found." />}
                    {filteredReports.map((report) => (
                        <div key={report.id} className={`bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all ${report.status === 'RESOLVED' ? 'opacity-75 bg-gray-50' : 'hover:shadow-md border-l-4 border-l-orange-400'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                        {report.location?.name || 'Unknown Location'}
                                        <StatusBadge status={report.status} />
                                    </h3>
                                    <span className="text-xs text-gray-400 mt-1 block">{new Date(report.createdAt).toLocaleDateString()} • 由 {report.user?.name || '匿名'} 回報</span>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg text-gray-700 text-sm mb-4 border border-gray-100">
                                {report.content}
                            </div>
                            
                            {report.status === 'PENDING' ? (
                                <div className="pt-3 border-t border-gray-100">
                                    <textarea 
                                        placeholder="輸入回覆內容並解決..." 
                                        className="w-full p-3 bg-white text-black border border-gray-200 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        rows={2}
                                        value={replyContent[report.id] || ''}
                                        onChange={(e) => setReplyContent({ ...replyContent, [report.id]: e.target.value })}
                                    />
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={() => handleReportAction(report.id, 'RESOLVED')}
                                            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
                                        >
                                            <Check size={14} /> 標示為已解決並回覆
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                report.adminReply && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <p className="text-xs font-bold text-gray-500 mb-1">管理員回覆：</p>
                                        <p className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-100">{report.adminReply}</p>
                                    </div>
                                )
                            )}
                        </div>
                    ))}
                  </>
              )}
          </div>
      )}

      {activeTab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4 order-2 lg:order-1">
              <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">Facility Requests</h2>
                  <span className="text-sm text-white">{filteredRequests.length} requests</span>
              </div>

              {isLoading ? (
                  <div className="space-y-4">
                      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                  </div>
              ) : (
                  <>
                    {filteredRequests.length === 0 && <EmptyState message="No requests found." />}
                    {filteredRequests.map((req) => (
                        <div key={req.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative group overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                req.status === 'PENDING' ? 'bg-yellow-400' : 
                                req.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-400'
                            }`} />
                            
                            <button
                                onClick={() => {
                                    setSelectedPos({ lat: req.data.lat, lng: req.data.lng })
                                }}
                                className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 z-10 bg-gray-50 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                title="在地圖上查看"
                            >
                                <MapPin size={18} />
                            </button>

                            <div className="pl-3 pr-12">
                                <div className="mb-3">
                                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                        {req.data.name}
                                        <StatusBadge status={req.status} />
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{req.data.type}</span>
                                        <span>•</span>
                                        <span>{req.data.floor || 'N/A'}</span>
                                        <span>•</span>
                                        <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span>{req.user?.name}</span>
                                    </div>
                                </div>
                                
                                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
                                    <span className="text-xs font-bold text-gray-400 block mb-1">描述</span>
                                    {req.data.description}
                                </div>
                                
                                {req.status === 'PENDING' ? (
                                    <div className="pt-3 border-t border-gray-100">
                                        <textarea 
                                            placeholder="輸入審核意見..." 
                                            className="w-full p-3 bg-white border border-gray-200 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            value={replyContent[req.id] || ''}
                                            onChange={(e) => setReplyContent({ ...replyContent, [req.id]: e.target.value })}
                                            rows={1}
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button 
                                                onClick={() => handleRequestAction(req.id, 'REJECTED')}
                                                className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 flex items-center gap-1 text-sm font-medium transition-colors"
                                            >
                                                <X size={16} /> 拒絕
                                            </button>
                                            <button 
                                                onClick={() => handleRequestAction(req.id, 'APPROVED')}
                                                className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-1 text-sm font-medium transition-colors"
                                            >
                                                <Check size={16} /> 核准
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    req.adminReply && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                            <p className="text-xs text-gray-500">回覆: {req.adminReply}</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                  </>
              )}
            </div>

            <div className="lg:col-span-5 order-1 lg:order-2">
                <div className="sticky top-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h2 className="font-bold text-gray-900">申請地點預覽</h2>
                            <span className="text-xs text-gray-500">橘色標記為待審核</span>
                        </div>
                        <div className="h-[400px] w-full relative">
                             <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                                <Map
                                    defaultCenter={NTU_CENTER}
                                    defaultZoom={15}
                                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                                    gestureHandling={'greedy'}
                                    disableDefaultUI={true}
                                >
                                    {filteredRequests.filter(r => r.status === 'PENDING').map((req) => (
                                        <AdvancedMarker 
                                            key={req.id} 
                                            position={{ lat: req.data.lat, lng: req.data.lng }}
                                            onClick={() => setSelectedPos({ lat: req.data.lat, lng: req.data.lng })}
                                        >
                                            <Pin background={'#F59E0B'} glyphColor={'#FFF'} borderColor={'#B45309'} />
                                        </AdvancedMarker>
                                    ))}
                                    {selectedPos && (
                                        <AdvancedMarker position={selectedPos}>
                                            <div className="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-bounce"></div>
                                        </AdvancedMarker>
                                    )}
                                </Map>
                            </APIProvider>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  )
}

// --- Sub Components ---

function NavButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                active 
                ? 'bg-gray-900 text-white shadow-md shadow-gray-200' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200'
            }`}
        >
            {children}
        </button>
    )
}

function FacilityCheckbox({ id, label, icon, className, register }: { id: Path<LocationFormData>, label: string, icon: string, className?: string, register: UseFormRegister<LocationFormData> }) {
    return (
        <label className={`flex items-center justify-between p-2.5 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 group ${className || ''}`}>
            <div className="flex items-center gap-3">
                <span className="text-lg opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
                <span className="text-sm text-gray-400 group-hover:text-gray-900 select-none">{label}</span>
            </div>
            <input 
                type="checkbox" 
                {...register(id)} 
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
            />
        </label>
    )
}

function StatCard({ title, value, icon, color = 'blue', onClick }: { title: string, value: number, icon: React.ReactNode, color?: string, onClick?: () => void }) {
    const bgColors: { [key: string]: string } = {
        blue: 'bg-blue-50 border-blue-100',
        red: 'bg-red-50 border-red-100',
        yellow: 'bg-yellow-50 border-yellow-100',
        green: 'bg-green-50 border-green-100'
    }

    return (
        <div 
            onClick={onClick}
            className={`p-6 rounded-xl border shadow-sm ${bgColors[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''}`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 font-medium">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                    {icon}
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: { [key: string]: string } = {
        PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        RESOLVED: 'bg-green-100 text-green-800 border-green-200',
        APPROVED: 'bg-green-100 text-green-800 border-green-200',
        REJECTED: 'bg-red-100 text-red-800 border-red-200',
    }
    
    const labels: { [key: string]: string } = {
        PENDING: '待處理',
        RESOLVED: '已解決',
        APPROVED: '已核准',
        REJECTED: '已拒絕',
    }

    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
            {labels[status] || status}
        </span>
    )
}

function SkeletonCard() {
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
        </div>
    )
}

function SkeletonOverview() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse h-32"></div>
                ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse h-[300px]"></div>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 mb-4">
                <Search className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-gray-500">{message}</p>
        </div>
    )
}
