import type { Context } from "hono";

export type MiddlewareFn = (c: Context, next: () => Promise<void>) => Promise<Response | void>;

export interface MiddlewarePipeline {
  use(fn: MiddlewareFn): void;
}

export class MiddlewareStack implements MiddlewarePipeline {
  private readonly stack: MiddlewareFn[] = [];

  use(fn: MiddlewareFn): void {
    this.stack.push(fn);
  }

  toArray(): MiddlewareFn[] {
    return [...this.stack];
  }

  clear(): void {
    this.stack.length = 0;
  }
}
