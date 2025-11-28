'use client'

import { useState, useEffect } from 'react'
import { useForm, UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { Location } from '@/types/location'
import { Trash2, Edit, Check, X } from 'lucide-react'
import Link from 'next/link'

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

export default function DashboardClient() {
  const [activeTab, setActiveTab] = useState<'locations' | 'reports' | 'requests'>('locations')
  const [locations, setLocations] = useState<Location[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [selectedPos, setSelectedPos] = useState<{ lat: number, lng: number } | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  
  // Reply state
  const [replyContent, setReplyContent] = useState<{ [key: string]: string }>({})

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LocationFormData>({
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

  const selectedType = watch('type')

  useEffect(() => {
    if (activeTab === 'locations') fetchLocations()
    if (activeTab === 'reports') fetchReports()
    if (activeTab === 'requests') fetchRequests()
  }, [activeTab])

  const fetchLocations = async () => {
    try {
        const res = await fetch('/api/locations')
        if (res.ok) setLocations(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchReports = async () => {
    try {
        const res = await fetch('/api/reports')
        if (res.ok) setReports(await res.json())
    } catch (e) { console.error(e) }
  }

  const fetchRequests = async () => {
    try {
        const res = await fetch('/api/requests')
        if (res.ok) setRequests(await res.json())
    } catch (e) { console.error(e) }
  }

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
    } else {
        alert('Failed to save')
    }
  }

  const handleEdit = (loc: Location) => {
      setEditingLocation(loc)
      setSelectedPos({ lat: loc.lat, lng: loc.lng })
      reset({
          ...loc,
          description: loc.description || '',
          floor: loc.floor || '',
      } as any)
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
          if (status === 'RESOLVED') alert('回報已解決')
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
          if (status === 'APPROVED') alert('已核准並新增地點')
          else alert('已拒絕申請')
      }
  }

  const handleMapClick = (e: any) => {
      if (e.detail.latLng) {
          const { lat, lng } = e.detail.latLng
          setSelectedPos({ lat, lng })
          setValue('lat', lat)
          setValue('lng', lng)
      }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('locations')}
                className={`px-4 py-2 rounded ${activeTab === 'locations' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                  設施資訊
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded ${activeTab === 'reports' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                  問題回報
              </button>
              <button 
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              >
                  地點申請
              </button>
              <Link 
                href="/"
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-blue-700 transition-colors font-medium"
              >
                回到首頁
              </Link>
          </div>
      </div>
      
      {activeTab === 'locations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
                <h2 className="text-xl font-bold mb-4">{editingLocation ? 'Edit Location' : 'Add New Location'}</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded bg-gray-800">
                    {/* Form Inputs */}
                    <div>
                        <label className="block text-sm font-medium text-white">Name</label>
                        <input {...register('name')} className="border w-full p-2 rounded text-white bg-gray-800 border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white">Type</label>
                        <select {...register('type')} className="border w-full p-2 rounded text-white bg-gray-800 border-gray-600">
                            <option value="TOILET">Toilet</option>
                            <option value="ACCESSIBLE_TOILET">Accessible Toilet</option>
                            <option value="NURSING_ROOM">Nursing Room</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white">Floor</label>
                        <input {...register('floor')} className="border w-full p-2 rounded text-white bg-gray-800 border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white">Description</label>
                        <textarea {...register('description')} className="border w-full p-2 rounded text-white bg-gray-800 border-gray-600" />
                    </div>
                    
                    <div className="space-y-3 bg-gray-800 p-3 rounded border border-gray-700">
                        <label className="block text-sm font-medium text-white mb-2">Facilities</label>
                        {selectedType === 'TOILET' && (
                            <>
                                <FacilityCheckbox id="hasTissue" label="Tissue (衛生紙)" icon="🧻" register={register} />
                                <FacilityCheckbox id="hasDryer" label="Dryer (烘手機)" icon="💨" register={register} />
                                <FacilityCheckbox id="hasSeat" label="Seat (坐式馬桶)" icon="🚽" register={register} />
                            </>
                        )}
                        {selectedType === 'NURSING_ROOM' && (
                            <>
                                <FacilityCheckbox id="hasDiaperTable" label="Diaper Table (尿布檯)" icon="👶" register={register} />
                                <FacilityCheckbox id="hasWaterDispenser" label="Water Dispenser (飲水機)" icon="💧" register={register} />
                                <FacilityCheckbox id="hasAutoDoor" label="Auto Door (自動門)" icon="🚪" register={register} />
                            </>
                        )}
                        {selectedType === 'ACCESSIBLE_TOILET' && (
                            <>
                                <FacilityCheckbox id="hasTissue" label="Tissue (衛生紙)" icon="🧻" register={register} />
                                <FacilityCheckbox id="hasDryer" label="Dryer (烘手機)" icon="💨" register={register} />
                                <FacilityCheckbox id="hasHandrail" label="Handrail (扶手)" icon="🤲" register={register} />
                            </>
                        )}
                    </div>

                    {/* Map Picker */}
                    <div>
                        <label className="block text-sm font-medium mb-2 text-white">Location</label>
                        <div className="h-[300px] w-full border relative">
                             <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                                <Map
                                    defaultCenter={NTU_CENTER}
                                    defaultZoom={16}
                                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                                    onClick={handleMapClick}
                                    gestureHandling={'greedy'}
                                    disableDefaultUI={true}
                                >
                                    {locations.map(loc => (
                                        <AdvancedMarker key={loc.id} position={{ lat: loc.lat, lng: loc.lng }}>
                                            <Pin background={'#999'} scale={0.7} borderColor={'transparent'} glyphColor={'transparent'} />
                                        </AdvancedMarker>
                                    ))}
                                    {selectedPos && (
                                        <AdvancedMarker position={selectedPos}>
                                            <Pin background={'#000'} glyphColor={'#FFF'} />
                                        </AdvancedMarker>
                                    )}
                                </Map>
                            </APIProvider>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            Lat: {selectedPos?.lat.toFixed(6) || '0'}, Lng: {selectedPos?.lng.toFixed(6) || '0'}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {editingLocation && (
                            <button type="button" onClick={() => { setEditingLocation(null); reset(); setSelectedPos(null); }} className="bg-gray-600 text-white px-4 py-2 rounded w-full">Cancel</button>
                        )}
                        <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded w-full">
                            {editingLocation ? 'Update Location' : 'Add Location'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Existing Locations List */}
            <div>
                <h2 className="text-xl font-bold mb-4">Existing Locations</h2>
                <div className="space-y-2 h-[80vh] overflow-y-auto">
                    {locations.map(loc => (
                        <div key={loc.id} className="flex justify-between items-center border p-4 rounded shadow-sm bg-black">
                            <div>
                                <h3 className="font-bold">{loc.name}</h3>
                                <p className="text-sm text-gray-500">{loc.type} - {loc.floor || 'N/A'}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleEdit(loc)} className="text-blue-500 p-2"><Edit size={20} /></button>
                                <button onClick={() => handleDelete(loc.id)} className="text-red-500 p-2"><Trash2 size={20} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
      )}

      {activeTab === 'reports' && (
          <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Member Reports</h2>
              {reports.length === 0 && <p className="text-gray-500">No reports found.</p>}
              {reports.map((report: any) => (
                  <div key={report.id} className={`bg-white p-4 rounded shadow border ${report.status === 'RESOLVED' ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between">
                          <h3 className="font-bold">{report.location?.name || 'Unknown Location'}</h3>
                          <span className="text-sm text-gray-500">{new Date(report.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-800 mt-2">{report.content}</p>
                      <div className="text-xs text-gray-500 mt-2">Reported by: {report.user?.name || report.user?.email}</div>
                      
                      {report.status === 'PENDING' ? (
                          <div className="mt-4 border-t pt-2">
                              <textarea 
                                  placeholder="輸入回覆內容..." 
                                  className="w-full p-2 border rounded mb-2 text-sm"
                                  value={replyContent[report.id] || ''}
                                  onChange={(e) => setReplyContent({ ...replyContent, [report.id]: e.target.value })}
                              />
                              <div className="flex justify-end">
                                  <button 
                                      onClick={() => handleReportAction(report.id, 'RESOLVED')}
                                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                  >
                                      解決並回覆
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="mt-2 pt-2 border-t">
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">RESOLVED</span>
                              {report.adminReply && <p className="text-sm text-gray-600 mt-1">回覆: {report.adminReply}</p>}
                          </div>
                      )}
                  </div>
              ))}
          </div>
      )}

      {activeTab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4 order-2 lg:order-1">
              <h2 className="text-xl font-bold mb-4">Facility Requests</h2>
              {requests.filter(r => r.status === 'PENDING').length === 0 && <p className="text-gray-500">No pending requests.</p>}
              {requests.filter(r => r.status === 'PENDING').map((req: any) => (
                  <div key={req.id} className="bg-white p-4 rounded shadow border relative group">
                      <button
                          onClick={() => {
                              setSelectedPos({ lat: req.data.lat, lng: req.data.lng })
                          }}
                          className="absolute top-4 right-4 text-blue-500 hover:text-blue-700 z-10"
                          title="View on Map"
                      >
                          📍 View Location
                      </button>
                      <div className="flex justify-between items-start pr-24">
                          <div>
                              <h3 className="font-bold text-gray-900">{req.data.name} <span className="text-sm font-normal text-gray-500">({req.data.type})</span></h3>
                              <p className="text-sm text-gray-600">Floor: {req.data.floor || 'N/A'}</p>
                              <p className="text-sm text-gray-600 mt-1 max-w-xs break-words">{req.data.description}</p>
                              <div className="text-xs text-gray-500 mt-2">Requested by: {req.user?.name}</div>
                              <div className="text-xs text-gray-400">Date: {new Date(req.createdAt).toLocaleDateString()}</div>
                          </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t">
                          <textarea 
                              placeholder="輸入回覆內容..." 
                              className="w-full p-2 border rounded mb-2 text-sm"
                              value={replyContent[req.id] || ''}
                              onChange={(e) => setReplyContent({ ...replyContent, [req.id]: e.target.value })}
                          />
                          <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => handleRequestAction(req.id, 'APPROVED')}
                                className="bg-green-100 text-green-600 px-3 py-1 rounded hover:bg-green-200 flex items-center gap-1 text-sm font-medium"
                              >
                                  <Check size={16} /> Approve
                              </button>
                              <button 
                                onClick={() => handleRequestAction(req.id, 'REJECTED')}
                                className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 flex items-center gap-1 text-sm font-medium"
                              >
                                  <X size={16} /> Reject
                              </button>
                          </div>
                      </div>
                  </div>
              ))}
            </div>

            <div className="order-1 lg:order-2">
                <div className="sticky top-8">
                    <h2 className="text-xl font-bold mb-4">Request Location Preview</h2>
                    <div className="h-[400px] w-full border relative rounded overflow-hidden shadow-md">
                         <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                            <Map
                                defaultCenter={NTU_CENTER}
                                defaultZoom={15}
                                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                                gestureHandling={'greedy'}
                                disableDefaultUI={true}
                            >
                                {requests.filter(r => r.status === 'PENDING').map((req: any) => (
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
                    <p className="text-sm text-gray-500 mt-2">
                        Orange pins are pending requests. Click "View Location" on a request card to highlight it on the map.
                    </p>
                </div>
            </div>
          </div>
      )}
    </div>
  )
}

function FacilityCheckbox({ id, label, icon, register }: { id: any, label: string, icon: string, register: UseFormRegister<any> }) {
    return (
        <div className="flex items-center justify-between p-2 hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <label htmlFor={id} className="text-sm text-white cursor-pointer select-none">{label}</label>
            </div>
            <input 
                type="checkbox" 
                {...register(id)} 
                id={id} 
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer" 
            />
        </div>
    )
}
