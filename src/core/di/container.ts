export interface Registration<T> {
  implementation: new (...args: never[]) => T;
  singleton: boolean;
  instance?: T;
}

export class Container {
  private readonly registry = new Map<string, Registration<unknown>>();
  private readonly instances = new Map<string, unknown>();

  register<T>(token: string, implementation: new (...args: never[]) => T, singleton = true): void {
    this.registry.set(token, { implementation, singleton });
  }

  resolve<T>(token: string): T {
    const registration = this.registry.get(token);
    if (!registration) {
      throw new Error(`No registration found for token: "${token}"`);
    }

    if (registration.singleton) {
      const existing = this.instances.get(token);
      if (existing) return existing as T;
      const instance = new registration.implementation();
      this.instances.set(token, instance);
      return instance as T;
    }

    return new registration.implementation() as T;
  }

  has(token: string): boolean {
    return this.registry.has(token);
  }

  clear(): void {
    this.registry.clear();
    this.instances.clear();
  }
}

export const container = new Container();
