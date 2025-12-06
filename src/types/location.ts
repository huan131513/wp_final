export type LocationType = 'TOILET' | 'ACCESSIBLE_TOILET' | 'NURSING_ROOM';

export interface ActiveIssue {
  type: string; // 'CLEAN' | 'NO_PAPER' | 'DIRTY' | 'MAINTENANCE' | 'CLOGGED' | 'OTHER'
  count: number;
  lastReportTime: string | Date;
}

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
  checkIns?: CheckIn[];
  
  // Frontend computed properties
  currentStatus?: string; // 'CLEAN' | 'NO_PAPER' | 'DIRTY' | 'MAINTENANCE' | 'CLOGGED' | 'OTHER'
  activeIssues?: ActiveIssue[]; // List of all active issues with details
  activeReportsCount?: number; // Total active reports (can still be useful)
  lastReportTime?: string | Date; // Global last report time
}

export interface CheckIn {
  id: string;
  userId: string;
  locationId: string;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

export interface Review {
  id: string;
  locationId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
