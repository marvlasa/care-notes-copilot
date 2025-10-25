import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import type { AppConfig } from "./config";

export interface CacheResources {
  cluster: aws.elasticache.Cluster;
}

export function createCache(
  config: AppConfig,
  subnetIds: pulumi.Output<string[]>,
  securityGroupId: pulumi.Output<string>
): CacheResources {
  const subnetGroup = new aws.elasticache.SubnetGroup("redis-subnet-group", {
    subnetIds,
    tags: { Name: `carenotes-redis-subnet-${config.environment}` },
  });

  const cluster = new aws.elasticache.Cluster("carenotes-redis", {
    engine: "redis",
    engineVersion: "7.0",
    nodeType: config.cacheNodeType,
    numCacheNodes: 1,
    parameterGroupName: "default.redis7",
    subnetGroupName: subnetGroup.name,
    securityGroupIds: [securityGroupId],
    tags: {
      Name: `carenotes-redis-${config.environment}`,
      Environment: config.environment,
    },
  });

  return { cluster };
}

