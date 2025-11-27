'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { Location } from '@/types/location'
import { Trash2 } from 'lucide-react'

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['TOILET', 'ACCESSIBLE_TOILET', 'NURSING_ROOM']),
  lat: z.number(),
  lng: z.number(),
  floor: z.string().optional(),
})

type LocationFormData = z.infer<typeof locationSchema>

const NTU_CENTER = { lat: 25.0174, lng: 121.5397 }

export default function DashboardClient() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedPos, setSelectedPos] = useState<{ lat: number, lng: number } | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      type: 'TOILET',
      lat: NTU_CENTER.lat,
      lng: NTU_CENTER.lng,
    }
  })

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
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      reset()
      setSelectedPos(null)
      fetchLocations()
    } else {
        alert('Failed to save location')
    }
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
            <h2 className="text-xl font-bold mb-4">Add New Location</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded">
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

                <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded w-full hover:bg-green-600">
                    Add Location
                </button>
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
                        <button 
                            onClick={() => handleDelete(loc.id)}
                            className="text-red-500 hover:text-red-700 p-2"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  )
}

