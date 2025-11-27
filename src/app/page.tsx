'use client'

import { useState, useEffect } from 'react'
import MapComponent from '@/components/MapComponent'
import { Location, LocationType } from '@/types/location'
import Link from 'next/link'

export default function Home() {
  const [locations, setLocations] = useState<Location[]>([])
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([])
  const [selectedType, setSelectedType] = useState<LocationType | 'ALL'>('ALL')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLocations(data)
          setFilteredLocations(data)
        }
        setIsLoading(false)
      })
      .catch(err => {
        console.error(err)
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selectedType === 'ALL') {
      setFilteredLocations(locations)
    } else {
      setFilteredLocations(locations.filter(loc => loc.type === selectedType))
    }
  }, [selectedType, locations])

  const handleLocationSelect = (loc: Location | null) => {
    setSelectedLocation(loc)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm z-10 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">NTU Campus Map</h1>
          </div>
          
          <nav className="flex gap-4">
            <Link 
              href="/admin" 
              className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-md hover:bg-gray-100"
            >
              Admin Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto p-4 gap-4">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex flex-col w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Filters</h2>
            <div className="space-y-2">
              <FilterButton 
                active={selectedType === 'ALL'} 
                onClick={() => setSelectedType('ALL')}
                icon={<span className="w-4 h-4 rounded-full bg-gray-400" />}
                label="All Facilities"
                count={locations.length}
              />
              <FilterButton 
                active={selectedType === 'TOILET'} 
                onClick={() => setSelectedType('TOILET')}
                icon={<span className="w-4 h-4 rounded-full bg-red-500" />}
                label="Toilets"
                count={locations.filter(l => l.type === 'TOILET').length}
              />
              <FilterButton 
                active={selectedType === 'ACCESSIBLE_TOILET'} 
                onClick={() => setSelectedType('ACCESSIBLE_TOILET')}
                icon={<span className="w-4 h-4 rounded-full bg-blue-500" />}
                label="Accessible"
                count={locations.filter(l => l.type === 'ACCESSIBLE_TOILET').length}
              />
              <FilterButton 
                active={selectedType === 'NURSING_ROOM'} 
                onClick={() => setSelectedType('NURSING_ROOM')}
                icon={<span className="w-4 h-4 rounded-full bg-pink-500" />}
                label="Nursing Rooms"
                count={locations.filter(l => l.type === 'NURSING_ROOM').length}
              />
            </div>
          </div>

          {/* Location List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Locations ({filteredLocations.length})
              </h2>
              {isLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
              ) : filteredLocations.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No locations found</div>
              ) : (
                <div className="space-y-2">
                  {filteredLocations.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => handleLocationSelect(loc)}
                      className={`w-full text-left p-3 rounded-lg transition-all border ${
                        selectedLocation?.id === loc.id
                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                          : 'hover:bg-gray-50 border-transparent hover:border-gray-100'
                      }`}
                    >
                      <h3 className={`font-medium text-sm ${selectedLocation?.id === loc.id ? 'text-blue-700' : 'text-gray-900'}`}>
                        {loc.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">{formatType(loc.type)}</span>
                        {loc.floor && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{loc.floor}</span>}
                      </div>
                    </button>
                  ))}
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
          />
          
          {/* Mobile Filter Toggle (Visible only on small screens) */}
          <div className="md:hidden absolute top-4 left-4 right-4 z-10 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {/* Simple pills for mobile */}
            {['ALL', 'TOILET', 'ACCESSIBLE_TOILET', 'NURSING_ROOM'].map((type) => (
               <button
                 key={type}
                 onClick={() => setSelectedType(type as any)}
                 className={`px-4 py-2 rounded-full text-xs font-bold shadow-md whitespace-nowrap ${
                   selectedType === type 
                     ? 'bg-blue-600 text-white' 
                     : 'bg-white text-gray-700'
                 }`}
               >
                 {type === 'ALL' ? 'All' : formatType(type as string)}
               </button>
            ))}
          </div>
        </div>
      </main>
    </div>
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
      className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
        active 
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
