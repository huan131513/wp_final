'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { MapComponent } from '@/components/MapComponent'
import { Location, LocationType } from '@/types/location'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import RequestFacilityModal from '@/components/RequestFacilityModal'
import { NotificationBell } from '@/components/NotificationBell'
import { Heart } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function HomeContent() {
  const { data: session } = useSession()
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedType, setSelectedType] = useState<LocationType | 'ALL' | 'SAVED'>('ALL')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [savedLocationIds, setSavedLocationIds] = useState<Set<string>>(new Set())

  const searchParams = useSearchParams()
  const initialLocationId = searchParams.get('locationId')

  useEffect(() => {
    if (initialLocationId && locations.length > 0) {
      const targetLoc = locations.find(l => l.id === initialLocationId)
      if (targetLoc) {
        setSelectedLocation(targetLoc)
        // Optionally clear the param so it doesn't stick
        // window.history.replaceState({}, '', '/')
      }
    }
  }, [locations, initialLocationId])

  useEffect(() => {
    if (!navigator.geolocation) return

    let watchId: number

    const startWatch = (highAccuracy: boolean) => {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          // Handle errors gracefully
          if (error.code === 1) {
             // PERMISSION_DENIED
             console.warn("User denied geolocation")
          } else if (highAccuracy) {
             // If high accuracy failed (TIMEOUT or POSITION_UNAVAILABLE), try low accuracy
             console.warn(`High accuracy location failed (${error.message}), switching to low accuracy...`)
             navigator.geolocation.clearWatch(watchId)
             startWatch(false)
          } else {
             // Low accuracy also failed
             console.warn("Error getting user location:", error.message)
          }
        },
        { 
            enableHighAccuracy: highAccuracy, 
            timeout: 10000, 
            maximumAge: 0 
        }
      )
    }

    startWatch(true)

    return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/locations')
      const data = await res.json()
      if (Array.isArray(data)) {
        setLocations(data)
        // Update selected location with new data if it exists
        // We need to be careful about setting state based on selectedLocation here to avoid loops
        // Instead, just update locations list.
      }
      setIsLoading(false)
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }, []) 

  const fetchSavedLocations = useCallback(async () => {
    if (!session) {
      setSavedLocationIds(new Set())
      return
    }
    try {
      const res = await fetch('/api/user/saved-locations')
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[] = await res.json()
        setSavedLocationIds(new Set(data.map(item => item.location.id)))
      }
    } catch (error) {
      console.error('Failed to fetch saved locations', error)
    }
  }, [session])

  useEffect(() => {
    fetchSavedLocations()
  }, [fetchSavedLocations])

  // Update selected location when locations list changes
  useEffect(() => {
      if (selectedLocation && locations.length > 0) {
          const updatedSelected = locations.find(l => l.id === selectedLocation.id)
          if (updatedSelected && updatedSelected !== selectedLocation) {
              setSelectedLocation(updatedSelected)
          }
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const filteredLocations = useMemo(() => {
    let filtered = locations

    if (selectedType === 'SAVED') {
      filtered = locations.filter(loc => savedLocationIds.has(loc.id))
    } else if (selectedType !== 'ALL') {
      filtered = locations.filter(loc => loc.type === selectedType)
    }

    if (userLocation) {
      filtered = [...filtered].sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
        return distA - distB
      })
    }
    return filtered
  }, [selectedType, locations, userLocation, savedLocationIds])

  const handleLocationSelect = (loc: Location | null) => {
    setSelectedLocation(loc)
    setIsMobileExpanded(false)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm z-10 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg">
              💩
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">NTU poop</h1>
          </div>

          <nav className="flex gap-4 items-center">
            {session ? (
              <>
                <NotificationBell />
                <span className="text-sm text-gray-600 hidden md:inline">Hi, {session.user?.name}</span>
                {session.user?.role === 'ADMIN' && (
                  <Link href="/admin/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    Dashboard
                  </Link>
                )}
                {session.user?.role === 'MEMBER' && (
                  <Link href="/member" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    會員中心
                  </Link>
                )}
                <Link href="/playground" className="text-sm font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1">
                  <span>🎮</span> <span className="hidden md:inline">遊樂場</span>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors px-3 py-2 rounded-md hover:bg-gray-100"
                >
                  登出
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-md hover:bg-gray-100"
                >
                  登入
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors px-3 py-2 rounded-md"
                >
                  註冊
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto p-4 gap-4 relative">
        {/* Sidebar - Desktop & Mobile Overlay */}
        <aside className={`
            flex flex-col bg-white overflow-hidden
            md:w-80 md:relative md:h-auto md:rounded-xl md:shadow-sm md:border md:border-gray-200
            fixed bottom-0 left-0 right-0 z-30 rounded-t-2xl shadow-[0_-2px_10px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out
            ${isMobileExpanded ? 'h-[80vh]' : 'h-[160px] md:h-auto'}
        `}>
          {/* Mobile Header with Handle */}
          <div
            className="md:hidden flex items-center justify-center p-2 cursor-pointer"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          {/* Filters (Hidden on mobile, using top pills instead) */}
          <div className="hidden md:block p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">分類</h2>
            <div className="space-y-2">
              <FilterButton
                active={selectedType === 'ALL'}
                onClick={() => setSelectedType('ALL')}
                icon={<span className="w-4 h-4 rounded-full bg-gray-400" />}
                label="所有設施"
                count={locations.length}
              />
              <FilterButton
                active={selectedType === 'TOILET'}
                onClick={() => setSelectedType('TOILET')}
                icon={<span className="w-4 h-4 rounded-full bg-red-500" />}
                label="廁所"
                count={locations.filter(l => l.type === 'TOILET').length}
              />
              <FilterButton
                active={selectedType === 'ACCESSIBLE_TOILET'}
                onClick={() => setSelectedType('ACCESSIBLE_TOILET')}
                icon={<span className="w-4 h-4 rounded-full bg-blue-500" />}
                label="無障礙廁所"
                count={locations.filter(l => l.type === 'ACCESSIBLE_TOILET').length}
              />
              <FilterButton
                active={selectedType === 'NURSING_ROOM'}
                onClick={() => setSelectedType('NURSING_ROOM')}
                icon={<span className="w-4 h-4 rounded-full bg-pink-500" />}
                label="哺乳室"
                count={locations.filter(l => l.type === 'NURSING_ROOM').length}
              />
              {session && (
                  <FilterButton
                  active={selectedType === 'SAVED'}
                  onClick={() => setSelectedType('SAVED')}
                  icon={<Heart size={16} className="text-pink-500 fill-pink-500" />}
                  label="我的最愛"
                  count={locations.filter(l => savedLocationIds.has(l.id)).length}
                />
              )}
            </div>
          </div>

          {/* Location List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:block">
                  位置 ({filteredLocations.length})
                </h2>
                {/* Mobile title */}
                <h2 className="text-lg font-bold md:hidden px-1">
                  附近地點 ({filteredLocations.length})
                </h2>

                {session?.user?.role === 'MEMBER' && (
                  <button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1"
                  >
                    <span>+</span> 新增設施
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No locations found</div>
              ) : (
                <div className="space-y-2">
                  {filteredLocations.map(loc => {
                    const distance = userLocation
                      ? Math.round(calculateDistance(userLocation.lat, userLocation.lng, loc.lat, loc.lng))
                      : null

                    return (
                      <button
                        key={loc.id}
                        onClick={() => handleLocationSelect(loc)}
                        className={`w-full text-left p-3 rounded-lg transition-all border ${selectedLocation?.id === loc.id
                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                            : 'hover:bg-gray-50 border-transparent hover:border-gray-100'
                          }`}
                      >
                        <h3 className={`font-medium text-sm ${selectedLocation?.id === loc.id ? 'text-blue-700' : 'text-gray-900'}`}>
                          {loc.name}
                        </h3>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">{formatType(loc.type)}</span>
                          {distance !== null ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                              {distance}m
                            </span>
                          ) : (
                            loc.floor && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{loc.floor}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Map Container */}
        <div className="flex-1 relative h-full min-h-[300px]">
          <MapComponent
            locations={filteredLocations}
            selectedLocation={selectedLocation}
            onLocationSelect={handleLocationSelect}
            onReviewAdded={fetchLocations}
            userLocation={userLocation}
            savedLocationIds={savedLocationIds}
            onSavedLocationsChange={fetchSavedLocations}
          />

          {/* Mobile Filter Toggle (Visible only on small screens) */}
          <div className="md:hidden absolute top-4 left-4 right-4 z-10 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {/* Simple pills for mobile */}
            {['ALL', 'TOILET', 'ACCESSIBLE_TOILET', 'NURSING_ROOM'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as LocationType | 'ALL')}
                className={`px-4 py-2 rounded-full text-xs font-bold shadow-md whitespace-nowrap ${selectedType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700'
                  }`}
              >
                {type === 'ALL' ? 'All' : formatType(type as string)}
              </button>
            ))}
            {session && (
                 <button
                 key="SAVED"
                 onClick={() => setSelectedType('SAVED')}
                 className={`px-4 py-2 rounded-full text-xs font-bold shadow-md whitespace-nowrap flex items-center gap-1 ${selectedType === 'SAVED'
                     ? 'bg-blue-600 text-white'
                     : 'bg-white text-gray-700'
                   }`}
               >
                 <Heart size={12} className={selectedType === 'SAVED' ? 'fill-white' : 'fill-none'} />
                 我的最愛
               </button>
            )}
          </div>
        </div>
    </main>

      {isRequestModalOpen && (
        <RequestFacilityModal onClose={() => setIsRequestModalOpen(false)} />
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}

function FilterButton({ active, onClick, icon, label, count }: {
  active: boolean,
  onClick: () => void,
  icon: React.ReactNode,
  label: string,
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${active
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
        {count}
      </span>
    </button>
  )
}

function formatType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}
