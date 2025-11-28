'use client'

import { useState } from 'react'
import { useForm, UseFormRegister, Path, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'

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

export default function RequestFacilityModal({ onClose }: { onClose: () => void }) {
    const [selectedPos, setSelectedPos] = useState<{ lat: number, lng: number } | null>(null)

    const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<LocationFormData>({
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
    })

    const onSubmit = async (data: LocationFormData) => {
        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (res.ok) {
                alert('申請已送出，待管理者審核！')
                onClose()
            } else {
                alert('申請失敗')
            }
        } catch (e) {
            console.error(e)
            alert('申請失敗')
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMapClick = (e: any) => {
        if (e.detail.latLng) {
            const { lat, lng } = e.detail.latLng
            setSelectedPos({ lat, lng })
            setValue('lat', lat)
            setValue('lng', lng)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white">
                <h2 className="text-xl font-bold mb-4">申請新增設施</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">名稱</label>
                        <input {...register('name')} className="border w-full p-2 rounded bg-gray-700 border-gray-600" />
                        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">類型</label>
                        <select {...register('type')} className="border w-full p-2 rounded bg-gray-700 border-gray-600">
                            <option value="TOILET">Toilet</option>
                            <option value="ACCESSIBLE_TOILET">Accessible Toilet</option>
                            <option value="NURSING_ROOM">Nursing Room</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">樓層</label>
                        <input {...register('floor')} className="border w-full p-2 rounded bg-gray-700 border-gray-600" />
                    </div>

                    <div className="space-y-3 bg-gray-700 p-3 rounded border border-gray-600">
                        <label className="block text-sm font-medium mb-2">設施</label>

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
                        <label className="block text-sm font-medium mb-2">位置 (點擊地圖選擇)</label>
                        <div className="h-[250px] w-full border border-gray-600 relative rounded overflow-hidden">
                            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
                                <Map
                                    defaultCenter={NTU_CENTER}
                                    defaultZoom={16}
                                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                                    onClick={handleMapClick}
                                    gestureHandling={'greedy'}
                                    disableDefaultUI={true}
                                >
                                    {selectedPos && (
                                        <AdvancedMarker position={selectedPos}>
                                            <Pin background={'#000'} glyphColor={'#FFF'} />
                                        </AdvancedMarker>
                                    )}
                                </Map>
                            </APIProvider>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            Lat: {selectedPos?.lat.toFixed(6) || '0'}, Lng: {selectedPos?.lng.toFixed(6) || '0'}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-600 text-white px-4 py-2 rounded w-full hover:bg-gray-500">
                            取消
                        </button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700">
                            送出申請
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function FacilityCheckbox({ id, label, icon, register }: { id: Path<LocationFormData>, label: string, icon: string, register: UseFormRegister<LocationFormData> }) {
    return (
        <div className="flex items-center justify-between p-2 hover:bg-gray-600 rounded transition-colors">
            <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <label htmlFor={id} className="text-sm text-white cursor-pointer select-none">{label}</label>
            </div>
            <input
                type="checkbox"
                {...register(id)}
                id={id}
                className="w-5 h-5 rounded border-gray-500 bg-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
        </div>
    )
}
