export type VehicleType = 'auto' | 'cab';

export interface SavedPlace {
  id: string;
  name: string;
  shortcode?: string;
  lat?: number;
  lng?: number;
  addedBy?: string;
  createdAt: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  calibrated?: boolean;
  samples?: number;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface AssistMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  phone?: string;
  isSos?: boolean;
  createdAt: string;
}

export interface SharedElderAccount {
  profileId: string;
  ownerName: string;
  ownerEmail?: string;
}

export interface ElderProfile {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  assistEmails: string[];
  places: SavedPlace[];
  sosContact: EmergencyContact;
  assists: AssistMember[];
}
