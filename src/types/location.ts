export type LocationType = 'TOILET' | 'ACCESSIBLE_TOILET' | 'NURSING_ROOM';

export interface Location {
  id: string;
  name: string;
  description: string | null;
  type: LocationType;
  lat: number;
  lng: number;
  floor: string | null;

  hasTissue: boolean;
  hasDryer: boolean;
  hasSeat: boolean;
  hasDiaperTable: boolean;
  hasWaterDispenser: boolean;
  hasAutoDoor: boolean;
  hasHandrail: boolean;

  createdAt: Date;
  updatedAt: Date;

  reviews?: Review[];
}

export interface Review {
  id: string;
  locationId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
