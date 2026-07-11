export { FirestoreManager, extractDocId } from "@/providers/firebase/firestore/manager";
export { FirestoreClient, FirestoreApiError } from "@/providers/firebase/firestore/client";
export { firestoreFieldsToJson, firestoreValueToJson, jsonToFirestoreValue, formatDocumentValue, formatSize, formatTimestamp } from "@/providers/firebase/firestore/format";
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
  FieldFilterOp,
  Value,
  CrudOperation,
  ExecutionMode,
  ExportFormat,
  SearchOptions,
  SearchResult,
  FavoriteItem,
  RecentItem,
  LatLng,
} from "@/providers/firebase/firestore/types";
