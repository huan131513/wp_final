'use client'

import { useState, useEffect, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import type { Location, LocationType } from '@/types/location'
import { useSession } from 'next-auth/react'
import { Heart, MessageCircle, Edit2, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const NTU_CENTER = { lat: 25.0174, lng: 121.5397 }

interface MapComponentProps {
    locations: Location[]
    selectedLocation: Location | null
    onLocationSelect: (location: Location | null) => void
    onReviewAdded?: () => void
    userLocation: { lat: number, lng: number } | null
    savedLocationIds: Set<string>
    onSavedLocationsChange: () => void
}

export function MapComponent({
    locations,
    selectedLocation,
    onLocationSelect,
    onReviewAdded,
    userLocation,
    savedLocationIds,
    onSavedLocationsChange
}: MapComponentProps) {
    const { data: session } = useSession()
    const [map, setMap] = useState<google.maps.Map | null>(null)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportContent, setReportContent] = useState('')
    const reportInputRef = useRef<HTMLTextAreaElement>(null)
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
    const [navigationInfo, setNavigationInfo] = useState<{ duration: string, distance: string } | null>(null)
    const [infoWindowWidth, setInfoWindowWidth] = useState(350)
    const [poops, setPoops] = useState<{ id: number, style: React.CSSProperties }[]>([])

  useEffect(() => {
        const handleResize = () => {
            setInfoWindowWidth(Math.min(350, window.innerWidth - 40))
          }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
  }, [])

    const handleNavigate = () => {
        if (!userLocation || !selectedLocation) {
            toast.error('無法取得您的位置或目標位置')
            return
        }

        const service = new google.maps.DirectionsService()
        service.route(
            {
                origin: userLocation,
                destination: { lat: selectedLocation.lat, lng: selectedLocation.lng },
                travelMode: google.maps.TravelMode.WALKING,
            },
            (result, status) => {
                if (status === 'OK' && result) {
                    setDirections(result)
                    // Extract duration and distance
                    const route = result.routes[0]
                    const leg = route.legs[0]
                    if (leg.duration && leg.distance) {
                        setNavigationInfo({
                            duration: leg.duration.text,
                            distance: leg.distance.text
                        })
                    }
                    onLocationSelect(null) // Close info window when navigation starts
                } else {
                    toast.error('無法規劃路線: ' + status)
                }
            }
        )
    }

    const handleCancelNavigation = () => {
        setDirections(null)
        setNavigationInfo(null)
    }

    const handleToggleSave = async () => {
        if (!selectedLocation || !session) return

        const isSaved = savedLocationIds.has(selectedLocation.id)
        const method = isSaved ? 'DELETE' : 'POST'
        const url = isSaved
            ? `/api/user/saved-locations?locationId=${selectedLocation.id}`
            : '/api/user/saved-locations'

        const body = isSaved ? undefined : JSON.stringify({ locationId: selectedLocation.id })

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body
            })

            if (res.ok) {
                if (isSaved) {
                    toast.success('已取消收藏')
                } else {
                    toast.success('已收藏地點')
                }
                onSavedLocationsChange()
            } else {
                toast.error('操作失敗')
            }
        } catch (e) {
            console.error(e)
            toast.error('操作失敗')
        }
    }

    const triggerPoopExplosion = () => {
        const newPoops = Array.from({ length: 30 }).map((_, i) => ({
            id: Date.now() + i,
            style: {
                left: '50%',
                top: '50%',
                '--tx': `${(Math.random() - 0.5) * 500}px`,
                '--ty': `${(Math.random() - 0.5) * 500}px`,
                '--r': `${(Math.random() - 0.5) * 720}deg`,
            } as React.CSSProperties
        }))
        setPoops(newPoops)
        setTimeout(() => setPoops([]), 3000)
    }

    const handleCheckIn = async () => {
        if (!selectedLocation || !session) return

        try {
            const res = await fetch('/api/check-ins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId: selectedLocation.id })
            })

            if (res.ok) {
                toast.success('打卡成功！')
                triggerPoopExplosion()
            } else {
                const data = await res.json()
                toast.error(data.error || '打卡失敗')
            }
        } catch (e) {
            console.error(e)
            toast.error('打卡失敗')
        }
    }

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
                toast.success('感謝您的回報！我們會盡快處理。')
                setIsReportModalOpen(false)
                setReportContent('')
            } else {
                toast.error('回報失敗，請稍後再試')
            }
        } catch (e) {
            console.error(e)
            toast.error('回報失敗')
        }
    }

    const handleRecenter = () => {
        if (userLocation && map) {
            map.panTo(userLocation)
            map.setZoom(17)
        }
    }

    const mapStyles = [
        {
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#ebe3cd"
                }
            ]
        },
        {
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#523735"
                }
            ]
        },
        {
            "elementType": "labels.text.stroke",
            "stylers": [
                {
                    "color": "#f5f1e6"
                }
            ]
        },
        {
            "featureType": "administrative",
            "elementType": "geometry.stroke",
            "stylers": [
                {
                    "color": "#c9b2a6"
                }
            ]
        },
        {
            "featureType": "administrative.land_parcel",
            "elementType": "geometry.stroke",
            "stylers": [
                {
                    "color": "#dcd2be"
                }
            ]
        },
        {
            "featureType": "administrative.land_parcel",
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#ae9e90"
                }
            ]
        },
        {
            "featureType": "landscape.natural",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#dfd2ae"
                }
            ]
        },
        {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#dfd2ae"
                }
            ]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#93817c"
                }
            ]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry.fill",
            "stylers": [
                {
                    "color": "#a5b076"
                }
            ]
        },
        {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#447530"
                }
            ]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#f5f1e6"
                }
            ]
        },
        {
            "featureType": "road.arterial",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#fdfcf8"
                }
            ]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#f8c967"
                }
            ]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [
                {
                    "color": "#e9bc62"
                }
            ]
        },
        {
            "featureType": "road.highway.controlled_access",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#e98d58"
                }
            ]
        },
        {
            "featureType": "road.highway.controlled_access",
            "elementType": "geometry.stroke",
            "stylers": [
                {
                    "color": "#db8555"
                }
            ]
        },
        {
            "featureType": "road.local",
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#806b63"
                }
            ]
        },
        {
            "featureType": "transit.line",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#dfd2ae"
                }
            ]
        },
        {
            "featureType": "transit.line",
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#8f7d77"
                }
            ]
        },
        {
            "featureType": "transit.line",
            "elementType": "labels.text.stroke",
            "stylers": [
                {
                    "color": "#ebe3cd"
                }
            ]
        },
        {
            "featureType": "transit.station",
            "elementType": "geometry",
            "stylers": [
                {
                    "color": "#dfd2ae"
                }
            ]
        },
        {
            "featureType": "water",
            "elementType": "geometry.fill",
            "stylers": [
                {
                    "color": "#b9d3c2"
                }
            ]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [
                {
                    "color": "#92998d"
                }
            ]
        }
    ]

  return (
        <>
            {/* Poop Explosion Overlay */}
            {poops.map(p => (
                <div key={p.id} className="poop-particle" style={p.style}>💩</div>
            ))}

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
                    styles={mapStyles}
                >
                    <MapHandler onMapLoad={setMap} />
                    <Directions directions={directions} />

                    {/* Navigation Info Overlay */}
                    {navigationInfo && (
                        <div className="absolute bottom-4 left-4 right-4 z-10 bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex justify-between items-center animate-slide-up">
                            <div>
                                <p className="text-xs text-gray-500">步行時間</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-blue-600">{navigationInfo.duration}</span>
                                    <span className="text-sm text-gray-600">({navigationInfo.distance})</span>
                                </div>
                            </div>
                            <button
                                onClick={handleCancelNavigation}
                                className="bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors text-sm"
                            >
                                取消導航
                            </button>
                        </div>
                    )}

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
                            maxWidth={infoWindowWidth}
             >
                            <div className="p-2 min-w-[250px] max-h-[400px] overflow-y-auto pr-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="text-2xl">
                                        {selectedLocation.type === 'TOILET' && '🚽'}
                                        {selectedLocation.type === 'ACCESSIBLE_TOILET' && '♿'}
                                        {selectedLocation.type === 'NURSING_ROOM' && '🍼'}
                                    </div>
                                    <div className="w-100 flex-1">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-bold text-xl text-gray-900 leading-tight mb-1">{selectedLocation.name}</h3>
                                            {session && (
                                                <button
                                                    onClick={handleToggleSave}
                                                    className={`p-1.5 rounded shadow-sm transition-colors flex-shrink-0 ${savedLocationIds.has(selectedLocation.id) ? 'bg-pink-100 text-pink-500' : 'bg-gray-100 text-gray-400 hover:text-pink-400'}`}
                                                    title={savedLocationIds.has(selectedLocation.id) ? '取消收藏' : '收藏'}
                                                >
                                                    <Heart size={16} fill={savedLocationIds.has(selectedLocation.id) ? 'currentColor' : 'none'} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-sm font-medium text-gray-500 mb-2">
                                            {formatLocationType(selectedLocation.type)}
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <button
                                                onClick={() => handleNavigate()}
                                                className="flex-1 bg-[#5485C2] hover:bg-blue-600 font-bold text-white text-xs py-1.5 px-2 rounded shadow-sm transition-colors whitespace-nowrap text-center"
                                            >
                                                導航
                                            </button>
                                            {(selectedLocation.type === 'TOILET' || selectedLocation.type === 'ACCESSIBLE_TOILET') && session && (
                                                <button
                                                    onClick={handleCheckIn}
                                                    className="flex-1 bg-[#BF6C06] hover:bg-[#6d360f] text-white font-bold text-xs py-1.5 px-2 rounded shadow-sm transition-colors whitespace-nowrap text-center"
                                                >
                                                    打卡
                                                </button>
                                            )}
                                            {session && (
                                                <button
                                                    onClick={() => setIsReportModalOpen(true)}
                                                    className="flex-1 bg-[#D4B92B] hover:bg-yellow-500 text-white font-bold text-xs py-1.5 px-2 rounded shadow-sm transition-colors whitespace-nowrap text-center"
                                                >
                                                    回報
                                                </button>
                                            )}
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

                                {selectedLocation.checkIns && selectedLocation.checkIns.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-gray-500 mb-2">最近打卡</h4>
                                        <div className="flex -space-x-2 overflow-hidden py-1 pl-1">
                                            {selectedLocation.checkIns.map((checkIn) => (
                                                <Link 
                                                    key={checkIn.id}
                                                    href={`/user/${checkIn.user?.name}`}
                                                    className="inline-block relative w-8 h-8 rounded-full ring-2 ring-white hover:z-10 hover:scale-110 transition-transform duration-200"
                                                    title={`${checkIn.user?.name} - ${new Date(checkIn.createdAt).toLocaleString()}`}
                                                >
                                                    {checkIn.user?.avatar && checkIn.user.avatar.startsWith('data:image') ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img 
                                                            src={checkIn.user.avatar} 
                                                            alt={checkIn.user.name} 
                                                            className="w-full h-full rounded-full object-cover bg-gray-200" 
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                                            {checkIn.user?.avatar || checkIn.user?.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                        className={`absolute right-14 bg-white p-3 rounded-full shadow-md hover:bg-gray-50 text-gray-600 transition-all duration-300 ${navigationInfo ? 'bottom-32' : 'bottom-6'}`}
                        title="Go to my location"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
      </div>
    </APIProvider>
    </>
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

    useEffect(() => {
        setLocalReviews(reviews)
    }, [reviews])

    const handleStartReview = () => {
        setIsAdding(true)
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
                setLocalReviews([newReview, ...localReviews])
                setIsAdding(false)
                setComment('')
                setRating(5)
                if (onReviewAdded) onReviewAdded()
                toast.success('評論已送出')
            }
        } catch (err) {
            console.error(err)
            toast.error('評論送出失敗')
        }
    }

    const updateReviewInList = (reviewId: string, updater: (review: any) => any) => {
        setLocalReviews(prev => prev.map((review: any) => {
            if (review.id === reviewId) {
                return updater(review)
            }
            if (review.replies) {
                return {
                    ...review,
                    replies: review.replies.map((reply: any) => 
                        reply.id === reviewId ? updater(reply) : reply
                    )
                }
            }
            return review
        }))
    }

    const averageRating = localReviews.length > 0 
        ? Math.round(localReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / localReviews.filter((r: any) => r.rating).length)
        : 0

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">評論</h4>
                <div className="flex text-yellow-400 text-sm">
                    {averageRating > 0 && '★'.repeat(averageRating)}
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

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {localReviews.map((review: any) => (
                    <ReviewItem
                        key={review.id}
                        review={review}
                        locationId={locationId}
                        onUpdate={updateReviewInList}
                        onRefresh={onReviewAdded}
                    />
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

function ReviewItem({ review, locationId, onUpdate, onRefresh }: { 
    review: any, 
    locationId: string, 
    onUpdate: (id: string, updater: (r: any) => any) => void,
    onRefresh?: () => void 
}) {
    const { data: session } = useSession()
    const [isReplying, setIsReplying] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [replyText, setReplyText] = useState('')
    const [editText, setEditText] = useState(review.comment)
    const [editRating, setEditRating] = useState(review.rating || 5)
    const [isLiked, setIsLiked] = useState(review.isLiked || false)
    const [likesCount, setLikesCount] = useState(review.likesCount || 0)
    const [showReplies, setShowReplies] = useState(true)
    const [localReplies, setLocalReplies] = useState(review.replies || [])

    const isOwner = session?.user?.id === review.userId

    const handleLike = async () => {
        if (!session) {
            toast.error('請先登入')
            return
        }

        try {
            const res = await fetch(`/api/reviews/${review.id}/likes`, {
                method: 'POST'
            })

            if (res.ok) {
                const data = await res.json()
                setIsLiked(data.isLiked)
                setLikesCount(data.likesCount)
                onUpdate(review.id, (r) => ({
                    ...r,
                    isLiked: data.isLiked,
                    likesCount: data.likesCount
                }))
            }
        } catch (err) {
            console.error(err)
            toast.error('操作失敗')
        }
    }

    const handleReply = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!session) {
            toast.error('請先登入')
            return
        }

        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId,
                    comment: replyText,
                    parentId: review.id
                })
            })

            if (res.ok) {
                const newReply = await res.json()
                setLocalReplies([...localReplies, newReply])
                setReplyText('')
                setIsReplying(false)
                onUpdate(review.id, (r) => ({
                    ...r,
                    repliesCount: (r.repliesCount || 0) + 1
                }))
                if (onRefresh) onRefresh()
                toast.success('回覆已送出')
            }
        } catch (err) {
            console.error(err)
            toast.error('回覆失敗')
        }
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch(`/api/reviews/${review.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    comment: editText,
                    rating: review.parentId ? undefined : editRating
                })
            })

            if (res.ok) {
                const updated = await res.json()
                onUpdate(review.id, () => updated)
                setIsEditing(false)
                if (onRefresh) onRefresh()
                toast.success('評論已更新')
            }
        } catch (err) {
            console.error(err)
            toast.error('更新失敗')
        }
    }

    const handleDelete = async () => {
        if (!confirm('確定要刪除這則評論嗎？')) return

        try {
            const res = await fetch(`/api/reviews/${review.id}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                onUpdate(review.id, (r) => ({ ...r, isDeleted: true, comment: '[已刪除]' }))
                if (onRefresh) onRefresh()
                toast.success('評論已刪除')
            }
        } catch (err) {
            console.error(err)
            toast.error('刪除失敗')
        }
    }

    if (review.isDeleted) {
        return (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 opacity-50">
                <p className="text-sm text-gray-400 italic">此評論已刪除</p>
            </div>
        )
    }

    return (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="flex items-center justify-between mb-1">
                {review.userId ? (
                    <Link
                        href={`/user/${encodeURIComponent(review.userName)}`}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden">
                            {review.user?.avatar && review.user.avatar.startsWith('data:image') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={review.user.avatar} alt={review.userName} className="w-full h-full object-cover" />
                            ) : (
                                (review.user?.avatar || review.userName.charAt(0).toUpperCase())
                            )}
                        </div>
                        <span className="font-medium text-sm text-blue-600 group-hover:underline">{review.userName}</span>
                    </Link>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white font-bold">
                            {review.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-900">{review.userName}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {review.rating && (
                        <span className="text-yellow-400 text-xs">{'★'.repeat(review.rating)}</span>
                    )}
                    {isOwner && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="編輯"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="刪除"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isEditing ? (
                <form onSubmit={handleEdit} className="mt-2">
                    {!review.parentId && (
                        <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">評分</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setEditRating(star)}
                                        className={`text-lg ${star <= editRating ? 'text-yellow-400' : 'text-gray-300'}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full text-sm p-2 border rounded text-black h-20 resize-none mb-2"
                        required
                    />
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false)
                                setEditText(review.comment)
                                setEditRating(review.rating || 5)
                            }}
                            className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-3 py-1 text-xs bg-blue-600 text-white font-bold rounded hover:bg-blue-700"
                        >
                            儲存
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <p className="text-sm text-gray-700 mb-1">{review.comment}</p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2">
                        <span>
                            {new Date(review.createdAt).toLocaleDateString()}
                            {review.editedAt && <span className="ml-1 text-gray-300">(已編輯)</span>}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <button
                            onClick={handleLike}
                            disabled={!session}
                            className={`flex items-center gap-1 text-xs transition-colors ${
                                isLiked
                                    ? 'text-red-500 hover:text-red-600'
                                    : 'text-gray-400 hover:text-red-500'
                            } ${!session ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                            <span>{likesCount}</span>
                        </button>
                        {session && (
                            <button
                                onClick={() => setIsReplying(!isReplying)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                            >
                                <MessageCircle size={14} />
                                <span>回覆</span>
                                {review.repliesCount > 0 && <span>({review.repliesCount})</span>}
                            </button>
                        )}
                    </div>

                    {isReplying && (
                        <form onSubmit={handleReply} className="mt-2 pt-2 border-t border-gray-200">
                            <textarea
                                placeholder="寫下您的回覆..."
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                className="w-full text-sm p-2 border rounded text-black h-16 resize-none mb-2"
                                required
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsReplying(false)
                                        setReplyText('')
                                    }}
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

                    {localReplies.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                            <button
                                onClick={() => setShowReplies(!showReplies)}
                                className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
                            >
                                {showReplies ? <X size={12} /> : <MessageCircle size={12} />}
                                <span>{showReplies ? '隱藏' : '顯示'}回覆 ({localReplies.length})</span>
                            </button>
                            {showReplies && (
                                <div className="space-y-2 ml-4">
                                    {localReplies.map((reply: any) => (
                                        <ReviewItem
                                            key={reply.id}
                                            review={reply}
                                            locationId={locationId}
                                            onUpdate={(id, updater) => {
                                                setLocalReplies((prev: any[]) => prev.map((r: any) => 
                                                    r.id === id ? updater(r) : r
                                                ))
                                            }}
                                            onRefresh={onRefresh}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
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

function Directions({ directions }: { directions: google.maps.DirectionsResult | null }) {
    const map = useMap()
    const routesLibrary = useMapsLibrary('routes')
    const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null)
    const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null)

    useEffect(() => {
        if (!routesLibrary || !map) return
        const renderer = new routesLibrary.DirectionsRenderer({
            map,
            suppressMarkers: false, // Show A/B markers
            preserveViewport: false // Let map fit bounds
        })
        // Do not set state here directly during render if possible, but useEffect is fine.
        setDirectionsService(new routesLibrary.DirectionsService())
        setDirectionsRenderer(renderer)

        return () => {
            renderer.setMap(null) // Clean up renderer when component unmounts
        }
    }, [routesLibrary, map])

    useEffect(() => {
        if (!directionsRenderer) return

        if (directions) {
            directionsRenderer.setMap(map) // Ensure map is attached
            directionsRenderer.setDirections(directions)
        } else {
            directionsRenderer.setMap(null) // Clear directions from map
        }
    }, [directionsRenderer, directions, map])

    return null
}
