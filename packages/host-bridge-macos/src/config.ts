import { z } from "zod";

export const macosBridgeConfigSchema = z.object({
  host: z.string().min(1).default("127.0.0.1"),
  port: z.coerce.number().int().positive().default(8787),
  authToken: z.string().min(1),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type MacosBridgeConfig = z.infer<typeof macosBridgeConfigSchema>;

export function loadMacosBridgeConfig(env: NodeJS.ProcessEnv): MacosBridgeConfig {
  return macosBridgeConfigSchema.parse({
    host: env.HOST,
    port: env.PORT,
    authToken: env.BRIDGE_AUTH_TOKEN,
    logLevel: env.LOG_LEVEL,
  });
}
