export type ContentType = 'single' | 'carousel' | 'video';

export interface Theme {
  id: string;
  thumbnail: string;
  supports: ContentType[];
  isFavourite: boolean;
}

export interface MediaAsset {
  uri: string;
  width: number;
  height: number;
  adjustments?: {
    translateX: number;
    translateY: number;
    scale: number;
  };
}

export interface Project {
  id: string;
  contentType: 'single' | 'carousel';
  themeId: string;
  beforeMedia: MediaAsset;
  afterMedia: MediaAsset;
  outputs: SavedAsset[];
  createdAt: string;
}

export interface SavedAsset {
  id: string;
  type: 'single' | 'carousel';
  projectId: string;
  themeId: string;
  thumbnailUri: string;
  outputUris: string[];
  createdAt: string;
  creditCost: number;
}

export interface UserCredits {
  balance: number;
  history: CreditTransaction[];
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: 'purchase' | 'spend' | 'refund';
  description: string;
  timestamp: string;
}

export interface BrandKit {
  logoUri?: string;
  primaryColor?: string;
  applyLogoAutomatically: boolean;
  addDisclaimer: boolean;
}
