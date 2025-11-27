'use client'

import { useState, useEffect, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import type { Location, LocationType } from '@/types/location'
import { useSession } from 'next-auth/react'

const NTU_CENTER = { lat: 25.0174, lng: 121.5397 }

interface MapComponentProps {
  locations: Location[]
  selectedLocation: Location | null
  onLocationSelect: (location: Location | null) => void
  onReviewAdded?: () => void
  userLocation: { lat: number, lng: number } | null
}

export default function MapComponent({ locations, selectedLocation, onLocationSelect, onReviewAdded, userLocation }: MapComponentProps) {
  const { data: session } = useSession()
  const [map, setMap] = useState<google.maps.Map | null>(null)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportContent, setReportContent] = useState('')
    const reportInputRef = useRef<HTMLTextAreaElement>(null)

    // Use local variable to avoid state update on every keystroke causing focus loss if re-rendered incorrectly
    // But here re-render is expected. The issue might be the InfoWindow or Map re-rendering aggressively.
    // Let's try to stop propagation of click events on the textarea to prevent map interactions.
    
    const handleReportSubmit = async () => {
      if (!selectedLocation || !session) return
      
      try {
          const res = await fetch('/api/reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  locationId: selectedLocation.id,
                  content: reportContent
              })
          })
          
          if (res.ok) {
              alert('感謝您的回報！我們會盡快處理。')
              setIsReportModalOpen(false)
              setReportContent('')
          } else {
              alert('回報失敗，請稍後再試')
          }
      } catch (e) {
          alert('回報失敗')
      }
  }

  const handleRecenter = () => {
      if (userLocation && map) {
          map.panTo(userLocation)
          map.setZoom(17)
      }
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <div className="h-full w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner relative">
        <Map
          defaultCenter={NTU_CENTER}
          defaultZoom={16}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          mapTypeId={'roadmap'}
          mapTypeControl={false}
        >
           <MapHandler onMapLoad={setMap} />
           {userLocation && (
               <AdvancedMarker position={userLocation}>
                   <div className="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg">
                       <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-pulse"></div>
                   </div>
               </AdvancedMarker>
           )}

           {locations.map(loc => (
             <AdvancedMarker
               key={loc.id}
               position={{ lat: loc.lat, lng: loc.lng }}
               onClick={() => onLocationSelect(loc)}
             >
               {getMarkerContent(loc.type)}
             </AdvancedMarker>
           ))}

            {selectedLocation && (
             <InfoWindow
               position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
               onCloseClick={() => onLocationSelect(null)}
               maxWidth={350}
             >
               <div className="p-2 min-w-[300px] max-h-[400px] overflow-y-auto pr-4">
                 <div className="flex items-center gap-2 mb-3">
                    <div className="text-2xl">
                        {selectedLocation.type === 'TOILET' && '🚽'}
                        {selectedLocation.type === 'ACCESSIBLE_TOILET' && '♿'}
                        {selectedLocation.type === 'NURSING_ROOM' && '🍼'}
                    </div>
                    <div className="w-100">
                        <div className="flex justify-between gap-2 ">
                            <h3 className="font-bold text-xl text-gray-900 leading-none">{selectedLocation.name}</h3>
                            {session && (
                                <button
                                    onClick={() => setIsReportModalOpen(true)}
                                    className="bg-yellow-400 hover:bg-yellow-500 text-white text-xs px-2 py-1 rounded shadow-sm transition-colors whitespace-nowrap"
                                >
                                    回報
                                </button>
                            )}
                        </div>
                        <div className="text-sm font-medium text-gray-500 mt-1">
                            {formatLocationType(selectedLocation.type)}
                        </div>
                    </div>
                 </div>
                 
                 <div className="space-y-2 border-t border-b py-3 mb-4">
                     {selectedLocation.floor && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">樓層</span>
                            <span className="font-medium text-gray-900">{selectedLocation.floor}</span>
                        </div>
                     )}
                     
                     {selectedLocation.type === 'TOILET' && (
                        <>
                            <FacilityItem label="衛生紙" has={selectedLocation.hasTissue} />
                            <FacilityItem label="烘手機" has={selectedLocation.hasDryer} />
                            <FacilityItem label="坐式馬桶" has={selectedLocation.hasSeat} />
                        </>
                     )}

                     {selectedLocation.type === 'NURSING_ROOM' && (
                        <>
                            <FacilityItem label="尿布檯" has={selectedLocation.hasDiaperTable} />
                            <FacilityItem label="飲水機" has={selectedLocation.hasWaterDispenser} />
                            <FacilityItem label="自動門" has={selectedLocation.hasAutoDoor} />
                        </>
                     )}

                     {selectedLocation.type === 'ACCESSIBLE_TOILET' && (
                        <>
                            <FacilityItem label="衛生紙" has={selectedLocation.hasTissue} />
                            <FacilityItem label="烘手機" has={selectedLocation.hasDryer} />
                            <FacilityItem label="扶手" has={selectedLocation.hasHandrail} />
                        </>
                     )}
                 </div>

                 {selectedLocation.description && (
                    <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {selectedLocation.description}
                    </div>
                 )}

                 <ReviewSection 
                    key={selectedLocation.id}
                    locationId={selectedLocation.id} 
                    reviews={selectedLocation.reviews || []} 
                    onReviewAdded={onReviewAdded}
                 />
               </div>
             </InfoWindow>
           )}
        </Map>
        
        {/* Report Modal */}
        {isReportModalOpen && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50"
                 onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching map
                 onMouseDown={(e) => e.stopPropagation()}
                 onMouseUp={(e) => e.stopPropagation()}
                 onTouchStart={(e) => e.stopPropagation()}
            >
                <div className="bg-white p-4 rounded-lg w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-bold text-lg mb-2">回報問題</h3>
                    <p className="text-sm text-gray-600 mb-2">地點：{selectedLocation?.name}</p>
                    <textarea
                        id="report-content"
                        name="report-content"
                        ref={reportInputRef}
                        className="w-full border rounded p-2 text-sm mb-4 h-24 text-black"
                        placeholder="請描述您遇到的問題..."
                        value={reportContent}
                        onChange={e => setReportContent(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} // Key events shouldn't bubble to map
                        onKeyUp={(e) => e.stopPropagation()}
                        onInput={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setIsReportModalOpen(false)}
                            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleReportSubmit}
                            className="px-3 py-1 text-sm bg-yellow-400 text-white rounded hover:bg-yellow-500"
                        >
                            送出
                        </button>
                    </div>
                </div>
            </div>
        )}

        {userLocation && (
            <button
                onClick={handleRecenter}
                className="absolute bottom-6 right-14 bg-white p-3 rounded-full shadow-md hover:bg-gray-50 text-gray-600 transition-colors"
                title="Go to my location"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
            </button>
        )}
      </div>
    </APIProvider>
  )
}

function FacilityItem({ label, has }: { label: string, has: boolean }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={`font-medium ${has ? 'text-green-600' : 'text-gray-400'}`}>
                {has ? '有' : '無'}
            </span>
        </div>
    )
}

function ReviewSection({ locationId, reviews, onReviewAdded }: { locationId: string, reviews: any[], onReviewAdded?: () => void }) {
    const { data: session } = useSession()
    const [isAdding, setIsAdding] = useState(false)
    const [rating, setRating] = useState(5)
    const [comment, setComment] = useState('')
    const [localReviews, setLocalReviews] = useState(reviews)
    const formRef = useRef<HTMLFormElement>(null)

    const handleStartReview = () => {
        setIsAdding(true)
        // Wait for the form to render, then scroll it into view
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId,
                    rating,
                    comment
                })
            })
            
            if (res.ok) {
                const newReview = await res.json()
                // Update local state immediately
                setLocalReviews([newReview, ...localReviews])
                setIsAdding(false)
                setComment('')
                setRating(5)
                // Trigger parent refresh to ensure data consistency
                if (onReviewAdded) onReviewAdded()
            }
        } catch (err) {
            console.error(err)
            alert('Failed to submit review')
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">評論</h4>
                <div className="flex text-yellow-400 text-sm">
                    {'★'.repeat(Math.round(localReviews.reduce((acc, r) => acc + r.rating, 0) / (localReviews.length || 1)))}
                    <span className="text-gray-400 ml-1">({localReviews.length})</span>
                </div>
            </div>

            {!isAdding ? (
                <button 
                    onClick={handleStartReview}
                    disabled={!session}
                    className={`w-full py-2 px-4 rounded-md text-sm font-medium mb-4 transition-colors flex items-center justify-between group
                        ${session 
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    <span>{session ? '新增評論...' : '登入後即可評論'}</span>
                    {session && <span className="text-gray-400 group-hover:text-gray-600">➜</span>}
                </button>
            ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="bg-gray-50 p-3 rounded-md mb-4 border border-gray-200">
                    <div className="mb-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">評分</label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mb-2">
                        <textarea 
                            placeholder="寫下您的評論..." 
                            required
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="w-full text-sm p-2 border rounded text-black h-20 resize-none"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button 
                            type="button" 
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
                        >
                            取消
                        </button>
                        <button 
                            type="submit"
                            className="px-3 py-1 text-xs bg-blue-600 text-white font-bold rounded hover:bg-blue-700"
                        >
                            送出
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {localReviews.map((review: any) => (
                    <div key={review.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white font-bold">
                                    {review.userName.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-sm text-gray-900">{review.userName}</span>
                            </div>
                            <span className="text-yellow-400 text-xs">{'★'.repeat(review.rating)}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{review.comment}</p>
                        <div className="text-[10px] text-gray-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                ))}
                {localReviews.length === 0 && (
                    <div className="text-center text-gray-400 text-sm py-4">
                        尚無評論，成為第一個評論者吧！
                    </div>
                )}
            </div>
        </div>
    )
}

const getMarkerContent = (type: LocationType) => {
  if (type === 'TOILET') {
    return (
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-red-600 rounded-md shadow-md flex items-center justify-center">
          <img 
            src="https://api.iconify.design/mdi:human-male-female.svg?color=white" 
            alt="Toilet" 
            className="w-6 h-6"
          />
        </div>
        {/* Triangle arrow at bottom */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rotate-45 shadow-sm -z-10"></div>
      </div>
    )
  } else if (type === 'ACCESSIBLE_TOILET') {
    return (
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-blue-800 rounded-md shadow-md flex items-center justify-center">
          <img 
            src="https://api.iconify.design/fa-solid:wheelchair.svg?color=white" 
            alt="Accessible Toilet" 
            className="w-5 h-5"
          />
        </div>
        {/* Triangle arrow at bottom */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-800 rotate-45 shadow-sm -z-10"></div>
      </div>
    )
  } else if (type === 'NURSING_ROOM') {
    return (
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-pink-300 rounded-md shadow-md flex items-center justify-center">
          <img 
            src="https://api.iconify.design/mdi:baby-bottle.svg?color=white" 
            alt="Nursing Room" 
            className="w-5 h-5"
          />
        </div>
        {/* Triangle arrow at bottom */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-pink-300 rotate-45 shadow-sm -z-10"></div>
      </div>
    )
  }

  // Default Pin for others for now, or can be customized similarly
  return (
    <Pin 
      background={getPinColor(type)} 
      glyphColor={'#FFF'} 
      borderColor={'#000'} 
    />
  )
}

const getPinColor = (type: LocationType) => {
  switch (type) {
    case 'TOILET': return '#EF4444' // Red
    case 'ACCESSIBLE_TOILET': return '#3B82F6' // Blue
    case 'NURSING_ROOM': return '#EC4899' // Pink
    default: return '#EF4444'
  }
}

const formatLocationType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function MapHandler({ onMapLoad }: { onMapLoad: (map: google.maps.Map | null) => void }) {
    const map = useMap()
    useEffect(() => {
        if (map) onMapLoad(map)
    }, [map, onMapLoad])
    return null
}

