export interface AuthUser {
  localId: string;
  email?: string;
  displayName?: string;
  phoneNumber?: string;
  photoUrl?: string;
  emailVerified: boolean;
  disabled: boolean;
  passwordHash?: string;
  passwordUpdatedAt?: number;
  validSince?: string;
  lastLoginAt?: string;
  createdAt?: string;
  providerUserInfo?: AuthProviderInfo[];
  customAttributes?: string;
  tenantId?: string;
  mfaInfo?: AuthMfaInfo[];
  screenName?: string;
}

export interface AuthProviderInfo {
  providerId: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string;
  rawId?: string;
  federatedId?: string;
  screenName?: string;
}

export interface AuthMfaInfo {
  mfaEnrollmentId: string;
  displayName?: string;
  phoneInfo?: string;
  enrolledAt?: string;
  mfaEnrolledDate?: string;
}

export interface AuthUserQueryResult {
  users: AuthUser[];
  nextPageToken?: string;
}

export interface AuthSearchOptions {
  query?: string;
  field?: "uid" | "email" | "phone" | "displayName";
  status?: "enabled" | "disabled" | "all";
  maxResults?: number;
  pageToken?: string;
}

export interface AuthUpdateRequest {
  localId: string;
  email?: string;
  password?: string;
  displayName?: string;
  phoneNumber?: string;
  photoUrl?: string;
  emailVerified?: boolean;
  disableUser?: boolean;
  customAttributes?: string;
  deleteAttribute?: string[];
  deleteProvider?: string[];
  returnSecureToken?: boolean;
}

export interface AuthCreateRequest {
  email?: string;
  password?: string;
  displayName?: string;
  phoneNumber?: string;
  photoUrl?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  localId?: string;
}

export interface AuthStats {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  disabledUsers: number;
  providerDistribution: Record<string, number>;
  adminEmails: string[];
}

export interface AuthLogEntry {
  action: string;
  localId?: string;
  email?: string;
  timestamp: string;
  duration: number;
  success: boolean;
  error?: string;
}

export interface AuthUserUpdateResult {
  localId: string;
  email?: string;
  displayName?: string;
  providerUserInfo?: AuthProviderInfo[];
  emailVerified: boolean;
  disabled: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  customAttributes?: string;
}

export interface OobCodeResult {
  email: string;
  oobLink?: string;
  oobCode?: string;
}

export interface QueryAccountsResponse {
  userInfo: AuthUser[];
  nextPageToken?: string;
}

export interface LookupResponse {
  users: AuthUser[];
}

export interface CreateAccountResponse {
  localId: string;
  email?: string;
  displayName?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
}

export interface UpdateAccountResponse {
  localId: string;
  email?: string;
  displayName?: string;
  providerUserInfo?: AuthProviderInfo[];
  emailVerified: boolean;
  disabled: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  customAttributes?: string;
}

export interface SendOobCodeResponse {
  email: string;
  oobLink?: string;
  oobCode?: string;
}
