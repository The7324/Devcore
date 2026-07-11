import type { FirebaseClient } from "@/providers/firebase/client";
import type {
  FirebaseMetadata,
  FirebaseCapability,
  FirebaseAuthMethod,
} from "@/providers/firebase/types";

const SDK_VERSION = "0.1.0";

export interface MetadataResult {
  metadata: FirebaseMetadata;
  latency: number;
}

export async function collectMetadata(
  client: FirebaseClient,
  projectId: string,
  authMethod: FirebaseAuthMethod = "service_account",
): Promise<MetadataResult> {
  const start = Date.now();

  const [firebaseProject, googleProject] = await Promise.all([
    client.getProjectInfo(projectId),
    client.getGoogleProject(projectId).catch(() => null),
  ]);

  const projectNumber = googleProject?.projectNumber ?? firebaseProject.projectNumber ?? "";
  let capabilities: FirebaseCapability[] = [];

  if (projectNumber) {
    try {
      capabilities = await client.getEnabledServices(projectNumber);
    } catch {
      capabilities = detectMinimalCapabilities(firebaseProject);
    }
  }

  const latency = Date.now() - start;

  const metadata: FirebaseMetadata = {
    projectId: firebaseProject.projectId,
    projectNumber,
    projectName: googleProject?.name ?? firebaseProject.displayName ?? firebaseProject.projectId,
    displayName: firebaseProject.displayName ?? googleProject?.name ?? firebaseProject.projectId,
    defaultBucket: firebaseProject.resources?.storageBucket,
    region: firebaseProject.resources?.locationId,
    sdkVersion: SDK_VERSION,
    validatedAt: new Date().toISOString(),
    authMethod,
    detectedCapabilities: capabilities,
    resources: {
      storageBucket: firebaseProject.resources?.storageBucket,
      databaseUrl: firebaseProject.resources?.realtimeDatabaseInstance
        ? `https://${firebaseProject.resources.realtimeDatabaseInstance}.firebaseio.com`
        : undefined,
      hostingSite: firebaseProject.resources?.hostingSite,
    },
  };

  return { metadata, latency };
}

function detectMinimalCapabilities(
  project: { resources?: { storageBucket?: string; realtimeDatabaseInstance?: string; hostingSite?: string } },
): FirebaseCapability[] {
  const caps: FirebaseCapability[] = [];
  if (project.resources?.storageBucket) caps.push("storage");
  if (project.resources?.realtimeDatabaseInstance) caps.push("realtime_database");
  if (project.resources?.hostingSite) caps.push("hosting");
  return caps;
}
