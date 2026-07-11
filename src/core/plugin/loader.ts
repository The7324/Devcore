import type { Plugin, PluginContext } from "@/core/plugin/interfaces";
import type { Logger } from "@/core/logger/logger";

export class PluginLoader {
  private readonly plugins = new Map<string, Plugin>();
  private started = false;

  constructor(private readonly logger: Logger) {}

  register(plugin: Plugin): void {
    const name = plugin.manifest.meta.name;
    if (this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is already registered.`);
    }
    this.plugins.set(name, plugin);
    this.logger.info(`Plugin registered: ${name} v${plugin.manifest.meta.version}`);
  }

  async initAll(context: PluginContext): Promise<void> {
    const order = this.resolveDependencyOrder();

    for (const name of order) {
      const plugin = this.plugins.get(name)!;
      this.logger.info(`Initializing plugin: ${name}`);
      await plugin.init(context);
    }
  }

  async startAll(): Promise<void> {
    if (this.started) return;
    this.started = true;

    for (const [name, plugin] of this.plugins) {
      if (plugin.start) {
        this.logger.info(`Starting plugin: ${name}`);
        await plugin.start();
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.stop) {
        this.logger.info(`Stopping plugin: ${name}`);
        await plugin.stop();
      }
    }
    this.plugins.clear();
    this.started = false;
  }

  get<T extends Plugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  private resolveDependencyOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (name: string, path: Set<string>) => {
      if (path.has(name)) {
        throw new Error(`Circular plugin dependency detected: "${name}"`);
      }
      if (visited.has(name)) return;
      path.add(name);

      const plugin = this.plugins.get(name);
      if (plugin?.manifest.dependencies) {
        for (const dep of plugin.manifest.dependencies) {
          if (!this.plugins.has(dep)) {
            throw new Error(
              `Plugin "${name}" depends on "${dep}" which is not registered.`,
            );
          }
          visit(dep, path);
        }
      }

      path.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const name of this.plugins.keys()) {
      visit(name, new Set());
    }

    return result;
  }
}
