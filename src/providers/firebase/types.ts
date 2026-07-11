export type FirebaseAuthMethod =
  | "service_account"
  | "google_cloud"
  | "oauth2"
  | "workload_identity";

export type FirebaseCapability =
  | "firestore"
  | "realtime_database"
  | "storage"
  | "authentication"
  | "cloud_messaging"
  | "remote_config"
  | "hosting"
  | "cloud_functions"
  | "app_check"
  | "analytics"
  | "ml_kit"
  | "performance"
  | "crashlytics"
  | "test_lab"
  | "extensions"
  | "vertex_ai"
  | "cloud_scheduler"
  | "cloud_run"
  | "secret_manager";

export interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

export interface FirebaseCredentials {
  projectId: string;
  serviceAccount: FirebaseServiceAccount;
  storageBucket?: string;
  appId?: string;
  region?: string;
}

export interface FirebaseMetadata {
  projectId: string;
  projectNumber: string;
  projectName: string;
  displayName: string;
  defaultBucket?: string;
  region?: string;
  sdkVersion: string;
  validatedAt: string;
  authMethod: FirebaseAuthMethod;
  detectedCapabilities: FirebaseCapability[];
  resources?: FirebaseResourceSummary;
}

export interface FirebaseResourceSummary {
  firestoreDatabase?: string;
  storageBucket?: string;
  databaseUrl?: string;
  hostingSite?: string;
  functionsRegion?: string;
}

export interface ValidationProgress {
  step: string;
  status: "pending" | "running" | "passed" | "failed";
  message: string;
}

export interface FirebaseHealthRecord {
  lastValidated: string | null;
  lastConnected: string | null;
  failureCount: number;
  lastError: string | null;
  latency: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface FirebaseProjectResponse {
  project: string;
  projectNumber: string;
  projectId: string;
  displayName: string;
  name: string;
  resources?: {
    hostingSite?: string;
    realtimeDatabaseInstance?: string;
    storageBucket?: string;
    locationId?: string;
  };
  state?: string;
}

export interface GoogleProjectResponse {
  projectNumber: string;
  projectId: string;
  name: string;
  lifecycleState: string;
  createTime: string;
  labels?: Record<string, string>;
  parent?: { type: string; id: string };
}

export interface GoogleService {
  name: string;
  parent: string;
  state: "ENABLED" | "DISABLED";
  config: { name: string; title: string };
}

export interface GoogleServiceResponse {
  services: GoogleService[];
  nextPageToken?: string;
}

export const FIREBASE_SERVICE_CAPABILITY_MAP: Record<string, FirebaseCapability> = {
  "firestore.googleapis.com": "firestore",
  "firebaserules.googleapis.com": "firestore",
  "firebasestorage.googleapis.com": "storage",
  "identitytoolkit.googleapis.com": "authentication",
  "fcm.googleapis.com": "cloud_messaging",
  "firebaseremoteconfig.googleapis.com": "remote_config",
  "firebasehosting.googleapis.com": "hosting",
  "cloudfunctions.googleapis.com": "cloud_functions",
  "firebaseappcheck.googleapis.com": "app_check",
  "firebaseanalytics.googleapis.com": "analytics",
  "ml.googleapis.com": "ml_kit",
  "firebaseperf.googleapis.com": "performance",
  "firebasecrashlytics.googleapis.com": "crashlytics",
  "testing.googleapis.com": "test_lab",
  "firebaseextensions.googleapis.com": "extensions",
  "vertexai.googleapis.com": "vertex_ai",
  "cloudscheduler.googleapis.com": "cloud_scheduler",
  "run.googleapis.com": "cloud_run",
  "secretmanager.googleapis.com": "secret_manager",
  "firebasedatabase.googleapis.com": "realtime_database",
};

export const FIREBASE_CAPABILITY_LABELS: Record<FirebaseCapability, string> = {
  firestore: "Cloud Firestore",
  realtime_database: "Realtime Database",
  storage: "Cloud Storage",
  authentication: "Authentication",
  cloud_messaging: "Cloud Messaging",
  remote_config: "Remote Config",
  hosting: "Hosting",
  cloud_functions: "Cloud Functions",
  app_check: "App Check",
  analytics: "Analytics",
  ml_kit: "ML Kit",
  performance: "Performance Monitoring",
  crashlytics: "Crashlytics",
  test_lab: "Test Lab",
  extensions: "Extensions",
  vertex_ai: "Vertex AI",
  cloud_scheduler: "Cloud Scheduler",
  cloud_run: "Cloud Run",
  secret_manager: "Secret Manager",
};

export const FIREBASE_CAPABILITY_ICONS: Record<FirebaseCapability, string> = {
  firestore: "🔥",
  realtime_database: "⚡",
  storage: "📦",
  authentication: "🔐",
  cloud_messaging: "📨",
  remote_config: "⚙️",
  hosting: "🌐",
  cloud_functions: "⚡",
  app_check: "✅",
  analytics: "📊",
  ml_kit: "🧠",
  performance: "📈",
  crashlytics: "💥",
  test_lab: "🧪",
  extensions: "🧩",
  vertex_ai: "🤖",
  cloud_scheduler: "⏰",
  cloud_run: "🏃",
  secret_manager: "🔑",
};
