'use client'

import { useState, useEffect } from 'react'
import { useForm, UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { Location } from '@/types/location'
import { Trash2, Edit } from 'lucide-react'

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
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedPos, setSelectedPos] = useState<{ lat: number, lng: number } | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)

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
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
        const res = await fetch('/api/locations')
        if (res.ok) {
            setLocations(await res.json())
        }
    } catch (e) {
        console.error(e)
    }
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
        const errorData = await res.json().catch(() => ({}))
        console.error('Save failed:', errorData)
        alert(`Failed to save location: ${errorData.error ? JSON.stringify(errorData.error) : res.statusText}`)
    }
  }

  const handleEdit = (loc: Location) => {
      setEditingLocation(loc)
      setSelectedPos({ lat: loc.lat, lng: loc.lng })
      
      setValue('name', loc.name)
      setValue('description', loc.description || '')
      setValue('type', loc.type)
      setValue('lat', loc.lat)
      setValue('lng', loc.lng)
      setValue('floor', loc.floor || '')
      setValue('hasTissue', loc.hasTissue)
      setValue('hasDryer', loc.hasDryer)
      setValue('hasSeat', loc.hasSeat)
      setValue('hasDiaperTable', loc.hasDiaperTable)
      setValue('hasWaterDispenser', loc.hasWaterDispenser)
      setValue('hasAutoDoor', loc.hasAutoDoor)
      setValue('hasHandrail', loc.hasHandrail)
  }

  const handleCancelEdit = () => {
      setEditingLocation(null)
      setSelectedPos(null)
      reset({
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
          name: '',
          description: '',
          floor: ''
      })
  }

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure?')) return
      const res = await fetch(`/api/locations/${id}`, { method: 'DELETE' })
      if (res.ok) fetchLocations()
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
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
            <h2 className="text-xl font-bold mb-4">{editingLocation ? 'Edit Location' : 'Add New Location'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded bg-gray-800">
                <div>
                    <label className="block text-sm font-medium text-white">Name</label>
                    <input {...register('name')} className="border w-full p-2 rounded text-white bg-gray-800 border-gray-600" />
                    {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
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

                <div>
                    <label className="block text-sm font-medium mb-2 text-white">Location (Click on map to select)</label>
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
                                    <AdvancedMarker
                                        key={loc.id}
                                        position={{ lat: loc.lat, lng: loc.lng }}
                                    >
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
                        <button 
                            type="button" 
                            onClick={handleCancelEdit}
                            className="bg-gray-600 text-white px-4 py-2 rounded w-full hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                    )}
                    <button type="submit" className={`${editingLocation ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'} text-white px-4 py-2 rounded w-full`}>
                        {editingLocation ? 'Update Location' : 'Add Location'}
                    </button>
                </div>
            </form>
        </div>

        <div>
            <h2 className="text-xl font-bold mb-4">Existing Locations</h2>
            <div className="space-y-2 h-[80vh] overflow-y-auto">
                {locations.map(loc => (
                    <div key={loc.id} className="flex justify-between items-center border p-4 rounded shadow-sm">
                        <div>
                            <h3 className="font-bold">{loc.name}</h3>
                            <p className="text-sm text-gray-500">{loc.type} - {loc.floor || 'N/A'}</p>
                        </div>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => handleEdit(loc)}
                                className="text-blue-500 hover:text-blue-700 p-2"
                            >
                                <Edit size={20} />
                            </button>
                            <button 
                                onClick={() => handleDelete(loc.id)}
                                className="text-red-500 hover:text-red-700 p-2"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
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
