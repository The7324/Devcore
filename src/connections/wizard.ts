import type { WizardState, CredentialField } from "@/connections/types";
import { ConnectionManager } from "@/connections/connection.manager";
import { ProviderRegistry } from "@/connections/provider.registry";

export class ConnectionWizard {
  private readonly sessions = new Map<number, WizardState>();

  constructor(
    private readonly manager: ConnectionManager,
    private readonly registry: ProviderRegistry,
  ) {}

  start(userId: number): WizardState {
    const state: WizardState = { step: "choose_provider", userId };
    this.sessions.set(userId, state);
    return state;
  }

  getState(userId: number): WizardState | undefined {
    return this.sessions.get(userId);
  }

  setProvider(userId: number, provider: string): WizardState | null {
    const state = this.sessions.get(userId);
    if (!state || state.step !== "choose_provider") return null;
    if (!this.registry.has(provider)) return null;
    state.provider = provider;
    state.step = "enter_name";
    return state;
  }

  setName(userId: number, name: string, description?: string, tags?: string[], environment?: string, region?: string): WizardState | null {
    const state = this.sessions.get(userId);
    if (!state || state.step !== "enter_name" || !state.provider) return null;
    state.name = name;
    state.description = description ?? "";
    state.tags = tags;
    state.environment = environment;
    state.region = region;
    state.step = "enter_credentials";
    return state;
  }

  setCredentials(userId: number, credentials: Record<string, string>): WizardState | null {
    const state = this.sessions.get(userId);
    if (!state || state.step !== "enter_credentials") return null;
    state.credentials = credentials;
    state.step = "save";
    return state;
  }

  getCredentialFields(userId: number): CredentialField[] | null {
    const state = this.sessions.get(userId);
    if (!state?.provider) return null;
    const provider = this.registry.get(state.provider);
    return provider?.meta.credentialSchema ?? null;
  }

  async save(userId: number): Promise<WizardState | null> {
    const state = this.sessions.get(userId);
    if (!state || state.step !== "save" || !state.provider || !state.name || !state.credentials) return null;

    try {
      const connection = await this.manager.create(userId, state.provider, state.name, state.description ?? "", state.credentials, {
        tags: state.tags,
        environment: state.environment,
        region: state.region,
      });
      state.connectionId = connection.id;
      state.step = "test";
      state.error = undefined;
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Failed to save connection";
    }

    return state;
  }

  async test(userId: number): Promise<WizardState | null> {
    const state = this.sessions.get(userId);
    if (!state || state.step !== "test" || !state.connectionId) return null;

    try {
      await this.manager.checkHealth(state.connectionId, userId);
      state.step = "complete";
      state.error = undefined;
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Connection test failed";
    }

    return state;
  }

  complete(userId: number): WizardState | null {
    const state = this.sessions.get(userId);
    if (!state) return null;
    this.sessions.delete(userId);
    return state;
  }

  cancel(userId: number): void {
    this.sessions.delete(userId);
  }

  get activeSessions(): number {
    return this.sessions.size;
  }
}
