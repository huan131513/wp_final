'use client'

import { useState, useEffect } from 'react'
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import type { Location, LocationType } from '@/types/location'

const NTU_CENTER = { lat: 25.0174, lng: 121.5397 }

interface MapComponentProps {
  locations: Location[]
  selectedLocation: Location | null
  onLocationSelect: (location: Location | null) => void
}

export default function MapComponent({ locations, selectedLocation, onLocationSelect }: MapComponentProps) {
  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <div className="h-full w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner">
        <Map
          defaultCenter={NTU_CENTER}
          defaultZoom={16}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          mapTypeId={'roadmap'}
        >
           {locations.map(loc => (
             <AdvancedMarker
               key={loc.id}
               position={{ lat: loc.lat, lng: loc.lng }}
               onClick={() => onLocationSelect(loc)}
             >
               <Pin 
                 background={getPinColor(loc.type)} 
                 glyphColor={'#FFF'} 
                 borderColor={'#000'} 
               />
             </AdvancedMarker>
           ))}

           {selectedLocation && (
             <InfoWindow
               position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
               onCloseClick={() => onLocationSelect(null)}
             >
               <div className="p-2 min-w-[200px]">
                 <h3 className="font-bold text-lg mb-1 text-gray-900">{selectedLocation.name}</h3>
                 <div className="text-sm font-semibold text-gray-600 mb-1">
                    {formatLocationType(selectedLocation.type)}
                 </div>
                 {selectedLocation.floor && (
                    <div className="text-sm mb-1 text-gray-700">
                        <span className="font-medium">Floor:</span> {selectedLocation.floor}
                    </div>
                 )}
                 {selectedLocation.description && (
                    <p className="mt-2 text-sm text-gray-600 border-t pt-2">
                        {selectedLocation.description}
                    </p>
                 )}
               </div>
             </InfoWindow>
           )}
        </Map>
      </div>
    </APIProvider>
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

