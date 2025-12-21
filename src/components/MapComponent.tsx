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
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
    const [navigationInfo, setNavigationInfo] = useState<{ duration: string, distance: string } | null>(null)
    const [infoWindowWidth, setInfoWindowWidth] = useState(350)
    const [poops, setPoops] = useState<{ id: number, style: React.CSSProperties }[]>([])

  useEffect(() => {
        const handleResize = () => {
            // Optimize for mobile (iPhone 12 Pro is 390px)
            // Use nearly full width on mobile, max 350px on desktop
            const width = window.innerWidth < 640 ? window.innerWidth - 20 : 350
            setInfoWindowWidth(width)
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
                            {getMarkerContent(loc)}
             </AdvancedMarker>
           ))}

           {selectedLocation && (
             <InfoWindow
               position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                            onCloseClick={() => onLocationSelect(null)}
                            maxWidth={infoWindowWidth}
             >
                            <div className="p-2 min-w-[200px] max-h-[400px] overflow-y-auto overflow-x-hidden pr-1">
                                {selectedLocation.activeIssues && selectedLocation.activeIssues.length > 0 ? (
                                    <div className="space-y-2 mb-3">
                                        {selectedLocation.activeIssues.map(issue => {
                                            const config = {
                                                'MAINTENANCE': { icon: '🔧', title: '設施維護或故障', bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' },
                                                'CLOGGED': { icon: '🚽', title: '馬桶嚴重堵塞', bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' },
                                                'NO_PAPER': { icon: '🧻', title: '目前缺乏衛生紙', bg: 'bg-yellow-50', text: 'text-yellow-900', border: 'border-yellow-200' },
                                                'DIRTY': { icon: '🤢', title: '環境髒亂需清理', bg: 'bg-yellow-50', text: 'text-yellow-900', border: 'border-yellow-200' },
                                                'OTHER': { icon: '⚠️', title: '使用者回報異常', bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200' }
                                            }[issue.type] || { icon: '⚠️', title: '使用者回報異常', bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200' }

                                            return (
                                                <div key={issue.type} className={`p-3 rounded-lg text-sm flex items-start gap-3 border shadow-sm ${config.bg} ${config.text} ${config.border}`}>
                                                    <span className="text-xl mt-0.5 flex-shrink-0">{config.icon}</span>
                                                    <div>
                                                        <p className="font-bold text-base leading-tight mb-1">{config.title}</p>
                                                        <p className="text-xs opacity-90 leading-relaxed">
                                                            最近 24 小時內有 <span className="font-bold">{issue.count}</span> 位使用者回報
                                                            {issue.lastReportTime && ` (最新：${new Date(issue.lastReportTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : selectedLocation.currentStatus && selectedLocation.currentStatus !== 'CLEAN' && (
                                    // Fallback for locations fetched before api update or if activeIssueTypes is empty but currentStatus is set
                                    <div className={`mb-3 p-3 rounded-lg text-sm flex items-start gap-3 animate-pulse-slow ${
                                        selectedLocation.currentStatus === 'MAINTENANCE' || selectedLocation.currentStatus === 'CLOGGED'
                                            ? 'bg-red-50 text-red-900 border border-red-200 shadow-sm' 
                                            : 'bg-yellow-50 text-yellow-900 border border-yellow-200 shadow-sm'
                                    }`}>
                                        <span className="text-xl mt-0.5 flex-shrink-0">
                                            {selectedLocation.currentStatus === 'MAINTENANCE' ? '🔧' : 
                                             selectedLocation.currentStatus === 'CLOGGED' ? '🚽' :
                                             selectedLocation.currentStatus === 'NO_PAPER' ? '🧻' :
                                             selectedLocation.currentStatus === 'DIRTY' ? '🤢' : '⚠️'}
                                        </span>
                                        <div>
                                            <p className="font-bold text-base leading-tight mb-1">
                                                {selectedLocation.currentStatus === 'MAINTENANCE' ? '設施維護或故障' : 
                                                 selectedLocation.currentStatus === 'CLOGGED' ? '馬桶嚴重堵塞' :
                                                 selectedLocation.currentStatus === 'NO_PAPER' ? '目前缺乏衛生紙' :
                                                 selectedLocation.currentStatus === 'DIRTY' ? '環境髒亂需清理' :
                                                 '使用者回報異常'}
                                            </p>
                                            <p className="text-xs opacity-90 leading-relaxed">
                                                最近 24 小時內有 <span className="font-bold">{selectedLocation.activeReportsCount}</span> 位使用者回報
                                                {selectedLocation.lastReportTime && ` (最新：${new Date(selectedLocation.lastReportTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`}
                                            </p>
                                        </div>
                                    </div>
                                )}

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
                                    reviews={selectedLocation.reviews}
                                    onReviewAdded={onReviewAdded}
                                />
               </div>
             </InfoWindow>
           )}
        </Map>

                {/* Report Modal */}
                {isReportModalOpen && selectedLocation && (
                    <ReportModal 
                        location={selectedLocation} 
                        onClose={() => setIsReportModalOpen(false)} 
                    />
                )}

                {userLocation && (
                    <button
                        onClick={handleRecenter}
                        className={`absolute right-4 md:right-14 bg-white p-3 rounded-full shadow-md hover:bg-gray-50 text-gray-600 transition-all duration-300 z-20 ${navigationInfo ? 'bottom-48 md:bottom-32' : 'bottom-48 md:bottom-6'}`}
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

function ReportModal({ location, onClose }: { location: Location, onClose: () => void }) {
    const [content, setContent] = useState('')
    const [type, setType] = useState<'CLEAN' | 'NO_PAPER' | 'DIRTY' | 'MAINTENANCE' | 'CLOGGED' | 'OTHER'>('OTHER')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        // 如果選擇了特定類型，內容可以是選填的，或者預設填充
        if (!content.trim() && type === 'OTHER') return

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId: location.id,
                    content: content || getDefaultContent(type),
                    type
                })
            })

            if (res.ok) {
                toast.success('感謝您的回報！我們會盡快處理。')
                onClose()
            } else {
                toast.error('回報失敗，請稍後再試')
            }
        } catch (e) {
            console.error(e)
            toast.error('回報失敗')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getDefaultContent = (t: string) => {
        switch(t) {
            case 'CLEAN': return '使用者回報：狀態正常'
            case 'NO_PAPER': return '使用者回報：缺少衛生紙'
            case 'DIRTY': return '使用者回報：環境髒亂'
            case 'MAINTENANCE': return '使用者回報：設施故障'
            case 'CLOGGED': return '使用者回報：馬桶堵塞'
            default: return '其他問題'
        }
    }

    const reportTypes = [
        { id: 'CLEAN', label: '正常/已恢復', icon: '🟢', color: 'bg-green-100 text-green-700 border-green-200' },
        { id: 'NO_PAPER', label: '缺紙', icon: '🧻', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
        { id: 'DIRTY', label: '髒亂', icon: '🤢', color: 'bg-orange-100 text-orange-700 border-orange-200' },
        { id: 'MAINTENANCE', label: '維修/故障', icon: '🔧', color: 'bg-red-100 text-red-700 border-red-200' },
        { id: 'CLOGGED', label: '堵塞', icon: '🚽', color: 'bg-red-100 text-red-700 border-red-200' },
        { id: 'OTHER', label: '其他', icon: '📝', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    ]

    return (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-xl text-gray-800">回報問題</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-sm text-gray-500 mb-4">地點：<span className="font-medium text-gray-800">{location.name}</span></p>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {reportTypes.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setType(item.id as any)}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                                type === item.id 
                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 ring-offset-1' 
                                    : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <span className="text-2xl">{item.icon}</span>
                            <span className="text-xs font-bold">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-700 mb-1">詳細描述 (選填)</label>
                    <textarea
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm h-20 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50"
                        placeholder="請描述詳細情況..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        onInput={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200 transition-all active:scale-95"
                    >
                        {isSubmitting ? '送出中...' : '送出回報'}
                    </button>
                </div>
            </div>
        </div>
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

function ReviewSection({ locationId, reviews, onReviewAdded }: { locationId: string, reviews?: any[], onReviewAdded?: () => void }) {
    const { data: session } = useSession()
    const [isAdding, setIsAdding] = useState(false)
    const [rating, setRating] = useState(5)
    const [comment, setComment] = useState('')
    const [localReviews, setLocalReviews] = useState<any[]>(reviews ?? [])
    const formRef = useRef<HTMLFormElement>(null)

    useEffect(() => {
        setLocalReviews(reviews ?? [])
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

    const isLoadingReviews = reviews === undefined
    const ratingReviews = localReviews.filter((r: any) => r?.rating)
    const averageRating =
        ratingReviews.length > 0
            ? Math.round(ratingReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / ratingReviews.length)
            : 0

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">評論</h4>
                <div className="flex text-yellow-400 text-sm">
                    {!isLoadingReviews && averageRating > 0 && '★'.repeat(averageRating)}
                    <span className="text-gray-400 ml-1">
                        ({isLoadingReviews ? '...' : localReviews.length})
                    </span>
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
                {isLoadingReviews ? (
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm py-6">
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                        <span>讀取評論中...</span>
                    </div>
                ) : (
                    localReviews.map((review: any) => (
                        <ReviewItem
                            key={review.id}
                            review={review}
                            locationId={locationId}
                            onUpdate={updateReviewInList}
                            onRefresh={onReviewAdded}
                        />
                    ))
                )}

                {!isLoadingReviews && localReviews.length === 0 && (
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
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity group min-w-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden flex-shrink-0">
                            {review.user?.avatar && review.user.avatar.startsWith('data:image') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={review.user.avatar} alt={review.userName} className="w-full h-full object-cover" />
                            ) : (
                                (review.user?.avatar || review.userName.charAt(0).toUpperCase())
                            )}
                        </div>
                        <span className="font-medium text-sm text-blue-600 group-hover:underline truncate">{review.userName}</span>
                    </Link>
                ) : (
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                            {review.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-900 truncate">{review.userName}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {review.rating && (
                        <span className="text-yellow-400 text-xs whitespace-nowrap">{'★'.repeat(review.rating)}</span>
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
                    <p className="text-sm text-gray-700 mb-1 break-words">{review.comment}</p>
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

const getMarkerContent = (location: Location) => {
    const { type, currentStatus } = location
    
    // Determine color based on status
    let bgColor = 'bg-blue-600' // Default Clean
    let triangleColor = 'bg-blue-600'
    
    // Status Logic
    const isSevere = currentStatus === 'MAINTENANCE' || currentStatus === 'CLOGGED'
    const isWarning = currentStatus === 'NO_PAPER' || currentStatus === 'DIRTY' || currentStatus === 'OTHER'
    
    if (isSevere) {
        bgColor = 'bg-red-600'
        triangleColor = 'bg-red-600'
    } else if (isWarning) {
        bgColor = 'bg-yellow-500'
        triangleColor = 'bg-yellow-500'
    } else {
        // Default colors by type if status is CLEAN
        if (type === 'TOILET') {
             bgColor = 'bg-red-600'
             triangleColor = 'bg-red-600'
        } else if (type === 'ACCESSIBLE_TOILET') {
             bgColor = 'bg-blue-600'
             triangleColor = 'bg-blue-600'
        } else if (type === 'NURSING_ROOM') {
             bgColor = 'bg-pink-400'
             triangleColor = 'bg-pink-400'
        }
    }

    // Status Icon Helper
    const getStatusIcon = (status?: string) => {
        switch(status) {
            case 'MAINTENANCE': return '🔧'
            case 'CLOGGED': return '🚽'
            case 'NO_PAPER': return '🧻'
            case 'DIRTY': return '🤢'
            case 'OTHER': return '📝'
            default: return null
        }
    }

    const statusIcon = getStatusIcon(currentStatus)

    if (type === 'TOILET') {
        return (
            <div className="relative w-8 h-8">
                <div className={`absolute inset-0 ${bgColor} rounded-md shadow-md flex items-center justify-center transition-colors duration-300`}>
                    <img
                        src="https://api.iconify.design/mdi:human-male-female.svg?color=white"
                        alt="Toilet"
                        className="w-6 h-6"
                    />
                    {statusIcon && (
                        <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm w-4 h-4 flex items-center justify-center border border-gray-100">
                            <div className="text-[10px] leading-none">{statusIcon}</div>
                        </div>
                    )}
                </div>
                {/* Triangle arrow at bottom */}
                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 ${triangleColor} rotate-45 shadow-sm -z-10 transition-colors duration-300`}></div>
            </div>
        )
    } else if (type === 'ACCESSIBLE_TOILET') {
        return (
            <div className="relative w-8 h-8">
                <div className={`absolute inset-0 ${bgColor} rounded-md shadow-md flex items-center justify-center transition-colors duration-300`}>
                    <img
                        src="https://api.iconify.design/fa-solid:wheelchair.svg?color=white"
                        alt="Accessible Toilet"
                        className="w-5 h-5"
                    />
                    {statusIcon && (
                         <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm w-4 h-4 flex items-center justify-center border border-gray-100">
                            <div className="text-[10px] leading-none">{statusIcon}</div>
                        </div>
                    )}
                </div>
                {/* Triangle arrow at bottom */}
                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 ${triangleColor} rotate-45 shadow-sm -z-10 transition-colors duration-300`}></div>
            </div>
        )
    } else if (type === 'NURSING_ROOM') {
        return (
            <div className="relative w-8 h-8">
                <div className={`absolute inset-0 ${bgColor} rounded-md shadow-md flex items-center justify-center transition-colors duration-300`}>
                    <img
                        src="https://api.iconify.design/mdi:baby-bottle.svg?color=white"
                        alt="Nursing Room"
                        className="w-5 h-5"
                    />
                     {statusIcon && (
                         <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm w-4 h-4 flex items-center justify-center border border-gray-100">
                            <div className="text-[10px] leading-none">{statusIcon}</div>
                        </div>
                    )}
                </div>
                {/* Triangle arrow at bottom */}
                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 ${triangleColor} rotate-45 shadow-sm -z-10 transition-colors duration-300`}></div>
            </div>
        )
    }

    // Default Pin for others
    return (
        <Pin
            background={isSevere ? '#EF4444' : isWarning ? '#EAB308' : getPinColor(type)}
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
