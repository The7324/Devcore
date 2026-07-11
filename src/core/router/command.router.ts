import type { Context } from "hono";
import type { Logger } from "@/core/logger/logger";
import type { MiddlewareFn } from "@/core/middleware/middleware";

export interface CommandHandler {
  (c: Context): Promise<Response | void>;
}

export interface CommandRoute {
  pattern: RegExp | string;
  handler: CommandHandler;
  middlewares?: MiddlewareFn[];
  description?: string;
}

export class CommandRouter {
  private readonly routes: CommandRoute[] = [];
  private readonly globalMiddlewares: MiddlewareFn[] = [];

  constructor(private readonly logger: Logger) {}

  use(middleware: MiddlewareFn): void {
    this.globalMiddlewares.push(middleware);
  }

  register(route: CommandRoute): void {
    this.routes.push(route);
    this.logger.debug(`Route registered: ${route.pattern}`);
  }

  async dispatch(c: Context): Promise<Response | void> {
    const path = c.req.path;
    const text = c.req.query("text") ?? path;

    const matched = this.routes.find((r) => {
      if (typeof r.pattern === "string") return text === r.pattern || path === r.pattern;
      return r.pattern.test(text) || r.pattern.test(path);
    });

    if (!matched) {
      this.logger.debug(`No route matched: ${text}`);
      return;
    }

    const chain = [...this.globalMiddlewares, ...(matched.middlewares ?? []), matched.handler];
    return this.runChain(c, chain);
  }

  private async runChain(c: Context, chain: MiddlewareFn[]): Promise<Response | void> {
    let index = 0;
    const next = async (): Promise<void> => {
      if (index >= chain.length) return;
      const fn = chain[index++]!;
      await fn(c, next);
    };
    return next();
  }

  routesCount(): number {
    return this.routes.length;
  }
}
