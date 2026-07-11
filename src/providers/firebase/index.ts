export { FirebaseProviderPlugin } from "@/providers/firebase/plugin";
export { FirebaseClient, FirebaseApiError, FirebaseAuthError } from "@/providers/firebase/client";
export { checkCredentialFormat, getNormalizedCredentials } from "@/providers/firebase/validation";
export { collectMetadata } from "@/providers/firebase/metadata";
export { firebaseCard, projectSummaryMarkdown, validationProgressMarkdown, detectedCapabilitiesMarkdown, healthStatusMarkdown, connectionDetailKeyboard } from "@/providers/firebase/ui";
export type {
  FirebaseServiceAccount,
  FirebaseCredentials,
  FirebaseMetadata,
  FirebaseCapability,
  FirebaseAuthMethod,
  FirebaseResourceSummary,
  ValidationProgress,
  FirebaseHealthRecord,
  FirebaseProjectResponse,
  GoogleProjectResponse,
  GoogleServiceResponse,
} from "@/providers/firebase/types";
export {
  FIREBASE_CAPABILITY_LABELS,
  FIREBASE_CAPABILITY_ICONS,
  FIREBASE_SERVICE_CAPABILITY_MAP,
} from "@/providers/firebase/types";

export { FirestoreManager } from "@/providers/firebase/firestore/manager";
export { FirestoreClient, FirestoreApiError } from "@/providers/firebase/firestore/client";
export { formatDocumentValue, formatSize, formatTimestamp, firestoreFieldsToJson } from "@/providers/firebase/firestore/format";
export type {
  FirestoreDatabase,
  FirestoreDocument,
  FirestoreStats,
  CollectionInfo,
  CollectionStats,
  BrowseOptions,
  BrowseResult,
  ExecuteQueryOptions,
  StructuredQuery,
  Filter,
  CrudOperation,
  ExportFormat,
  SearchOptions,
  SearchResult,
  FavoriteItem,
  RecentItem,
} from "@/providers/firebase/firestore/types";
