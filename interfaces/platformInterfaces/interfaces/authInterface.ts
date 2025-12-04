// Interface for auth token
export interface AuthTokenAttributes {
  id: number;
  token: string;
  expiresAt: Date;
  refreshTokenId: number;
  userId: number;
  lastUsed?: Date | null;
  isDeleted?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for refresh token
export interface RefreshTokenAttributes {
  id: number;
  token: string;
  expiresAt: Date;
  userAgent: string;
  deviceToken?: string;
  deviceName?: string | null;
  lastUsed?: Date | null;
  refreshCount: number;
  isDeleted?: boolean;
  userId: number;

  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for feature flags
export interface FeatureFlagsMainAttributes {
  id: number;
  feature: string;
  value: string;
  description: string;
  createdBy: number;
  lastUpdatedBy: number;
  isDeleted: boolean;
  environment: string;
  androidVersion?: string | null;
  iosVersion?: string | null;
  websiteVersion?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
