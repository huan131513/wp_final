export type LocationType = 'TOILET' | 'ACCESSIBLE_TOILET' | 'NURSING_ROOM';

export interface Location {
  id: string;
  name: string;
  description: string | null;
  type: LocationType;
  lat: number;
  lng: number;
  floor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

