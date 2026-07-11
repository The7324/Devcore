export type GitHubAuthMethod = "pat" | "fine_grained_pat" | "github_app" | "oauth";
export type GitHubCapability =
  | "repositories"
  | "issues"
  | "pull_requests"
  | "actions"
  | "packages"
  | "releases"
  | "codespaces"
  | "projects"
  | "security_alerts";

export interface GitHubCredentials {
  accessToken: string;
  defaultOwner?: string;
  defaultRepository?: string;
  preferredOrganization?: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: "User" | "Organization";
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  private_gists?: number;
  total_private_repos?: number;
  owned_private_repos?: number;
  disk_usage?: number;
  collaborators?: number;
  plan?: { name: string; space: number; private_repos: number; collaborators: number };
}

export interface GitHubOrganization {
  login: string;
  id: number;
  node_id: string;
  url: string;
  repos_url: string;
  events_url: string;
  hooks_url: string;
  issues_url: string;
  members_url: string;
  public_members_url: string;
  avatar_url: string;
  description: string | null;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  twitter_username: string | null;
  is_verified: boolean;
  has_organization_projects: boolean;
  has_repository_projects: boolean;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  type: string;
}

export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: { login: string; id: number; avatar_url: string; html_url: string };
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  forks_url: string;
  keys_url: string;
  collaborators_url: string;
  teams_url: string;
  hooks_url: string;
  issue_events_url: string;
  events_url: string;
  assignees_url: string;
  branches_url: string;
  tags_url: string;
  blobs_url: string;
  git_tags_url: string;
  git_refs_url: string;
  trees_url: string;
  statuses_url: string;
  languages_url: string;
  stargazers_url: string;
  contributors_url: string;
  subscribers_url: string;
  subscription_url: string;
  commits_url: string;
  git_commits_url: string;
  comments_url: string;
  issue_comment_url: string;
  contents_url: string;
  compare_url: string;
  merges_url: string;
  archive_url: string;
  downloads_url: string;
  issues_url: string;
  pulls_url: string;
  milestones_url: string;
  notifications_url: string;
  labels_url: string;
  releases_url: string;
  deployments_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: { key: string; name: string; spdx_id: string; url: string; node_id: string } | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: string;
  forks: number;
  open_issues: number;
  watchers: number;
  default_branch: string;
  permissions?: { admin: boolean; maintain: boolean; push: boolean; triage: boolean; pull: boolean };
}

export interface GitHubMetadata {
  username: string;
  userId: number;
  accountType: "User" | "Organization";
  avatarUrl: string;
  primaryEmail: string | null;
  planName: string | null;
  organizations: GitHubOrganization[];
  publicRepoCount: number;
  privateRepoCount: number | null;
  detectedCapabilities: GitHubCapability[];
  validatedAt: string;
  defaultOwner?: string;
}

export interface GitHubRepoSearchResult {
  items: GitHubRepository[];
  totalCount: number;
  incompleteResults: boolean;
}

export interface GitHubValidationProgress {
  step: string;
  status: "pending" | "running" | "passed" | "failed";
  message: string;
}

export interface GitHubHealthRecord {
  lastValidated: string | null;
  lastConnected: string | null;
  failureCount: number;
  lastError: string | null;
  latency: number;
}

export interface GitHubRateLimit {
  resources: {
    core: { limit: number; remaining: number; reset: number; used: number };
    search: { limit: number; remaining: number; reset: number; used: number };
    graphql?: { limit: number; remaining: number; reset: number; used: number };
  };
  rate: { limit: number; remaining: number; reset: number; used: number };
}

export const GITHUB_CAPABILITY_LABELS: Record<GitHubCapability, string> = {
  repositories: "Repositories",
  issues: "Issues",
  pull_requests: "Pull Requests",
  actions: "Actions",
  packages: "Packages",
  releases: "Releases",
  codespaces: "Codespaces",
  projects: "Projects",
  security_alerts: "Security Alerts",
};

export const GITHUB_CAPABILITY_ICONS: Record<GitHubCapability, string> = {
  repositories: "📦",
  issues: "🐛",
  pull_requests: "🔄",
  actions: "⚡",
  packages: "📦",
  releases: "🏷️",
  codespaces: "💻",
  projects: "📋",
  security_alerts: "🔒",
};

export const GITHUB_PERMISSION_CAPABILITY_MAP: Record<string, GitHubCapability> = {
  "administration": "repositories",
  "contents": "repositories",
  "metadata": "repositories",
  "issues": "issues",
  "pull_requests": "pull_requests",
  "actions": "actions",
  "packages": "packages",
  "deployments": "releases",
  "codespaces": "codespaces",
  "projects": "projects",
  "secret_scanning_alerts": "security_alerts",
  "dependabot_security_analysis": "security_alerts",
};

export const GITHUB_DEFAULT_PERMISSIONS: string[] = [
  "metadata", "contents", "issues", "pull_requests",
];
