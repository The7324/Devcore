import type { ProviderPlugin, ProviderMeta } from "@/connections/types";

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderPlugin>();

  register(plugin: ProviderPlugin): void {
    const name = plugin.meta.name;
    if (this.providers.has(name)) {
      throw new Error(`Provider "${name}" is already registered`);
    }
    this.providers.set(name, plugin);
  }

  get(name: string): ProviderPlugin | undefined {
    return this.providers.get(name);
  }

  getAll(): ProviderPlugin[] {
    return [...this.providers.values()];
  }

  getMetas(): ProviderMeta[] {
    return this.getAll().map((p) => p.meta);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  getCredentialSchema(provider: string): ProviderPlugin["meta"]["credentialSchema"] | undefined {
    return this.providers.get(provider)?.meta.credentialSchema;
  }

  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  get count(): number {
    return this.providers.size;
  }
}
