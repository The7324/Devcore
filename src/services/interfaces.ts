import type { Logger } from "@/core/logger/logger";
import type { Container } from "@/core/di/container";

export interface ServiceMeta {
  name: string;
  version?: string;
}

export interface ServiceContext {
  container: Container;
  logger: Logger;
}

export interface Service {
  meta: ServiceMeta;
  init(context: ServiceContext): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
