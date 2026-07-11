export { GitHubProviderPlugin } from "@/providers/github/plugin";
export { GitHubClient, GitHubApiError } from "@/providers/github/client";
export { GitHubManager } from "@/providers/github/manager";
export { checkCredentialFormat, getNormalizedCredentials } from "@/providers/github/validation";
export { githubCard, validationProgressMarkdown, detectedCapabilitiesMarkdown, healthStatusMarkdown, connectionDetailKeyboard, repoStatsMarkdown } from "@/providers/github/ui";
export type {
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubMetadata,
  GitHubCapability,
  GitHubAuthMethod,
  GitHubCredentials,
  GitHubRepoSearchResult,
  GitHubValidationProgress,
  GitHubHealthRecord,
  GitHubRateLimit,
} from "@/providers/github/types";
export {
  GITHUB_CAPABILITY_LABELS,
  GITHUB_CAPABILITY_ICONS,
  GITHUB_PERMISSION_CAPABILITY_MAP,
  GITHUB_DEFAULT_PERMISSIONS,
} from "@/providers/github/types";
