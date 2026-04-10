import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

export const serverRuntimeConfigSchema = z.object({
  serverId: z.string().min(1),
  serverName: z.string().min(1),
  serverVersion: z.string().min(1),
  host: z.string().min(1).default("0.0.0.0"),
  port: z.coerce.number().int().positive().default(8080),
  authToken: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  bridgeEndpoint: z.string().url(),
  bridgeAuthToken: z.string().min(1),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  requestTimeoutMs: z.coerce.number().int().positive().default(10000),
});

export type ServerRuntimeConfig = z.infer<typeof serverRuntimeConfigSchema>;

export function loadServerRuntimeConfig(
  env: NodeJS.ProcessEnv,
  defaults: Pick<ServerRuntimeConfig, "serverId" | "serverName" | "serverVersion">,
): ServerRuntimeConfig {
  return serverRuntimeConfigSchema.parse({
    serverId: env.SERVER_ID ?? defaults.serverId,
    serverName: env.SERVER_NAME ?? defaults.serverName,
    serverVersion: env.SERVER_VERSION ?? defaults.serverVersion,
    host: env.HOST,
    port: env.PORT,
    authToken: env.AUTH_TOKEN,
    bridgeEndpoint: env.BRIDGE_ENDPOINT,
    bridgeAuthToken: env.BRIDGE_AUTH_TOKEN,
    logLevel: env.LOG_LEVEL,
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
  });
}
