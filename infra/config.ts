import * as pulumi from "@pulumi/pulumi";

export interface AppConfig {
  environment: string;
  domain: string;
  dbInstanceClass: string;
  cacheNodeType: string;
  appCpu: number;
  appMemory: number;
  appDesiredCount: number;
  isProd: boolean;
}

export function loadConfig(): AppConfig {
  const config = new pulumi.Config();
  const stack = pulumi.getStack();
  const isProd = stack === "prod";

  return {
    environment: stack,
    domain: config.get("domain") || `carenotes-${stack}.example.com`,
    dbInstanceClass: config.get("dbInstanceClass") || "db.t4g.micro",
    cacheNodeType: config.get("cacheNodeType") || "cache.t4g.micro",
    appCpu: config.getNumber("appCpu") || 512,
    appMemory: config.getNumber("appMemory") || 1024,
    appDesiredCount: config.getNumber("appDesiredCount") || (isProd ? 2 : 1),
    isProd,
  };
}

