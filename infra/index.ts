/**
 * Pulumi Infrastructure as Code - Main Entry Point
 *
 * Deploy CareNotes Copilot to AWS with:
 * - ECS Fargate for Next.js app
 * - RDS PostgreSQL with pgvector
 * - ElastiCache Redis
 * - ALB for load balancing
 * - CloudWatch for logging/monitoring
 *
 * Usage:
 *   cd infra
 *   pulumi up
 */

import * as pulumi from "@pulumi/pulumi";
import { loadConfig } from "./config";
import { createNetwork } from "./network";
import { createDatabase } from "./database";
import { createCache } from "./cache";
import { createSecretsManager } from "./secrets";
import { createLoadBalancer } from "./loadbalancer";
import { createContainerService } from "./container";

// Load configuration
const config = loadConfig();

// Create network infrastructure
const network = createNetwork(config.environment);

// Create database
const database = createDatabase(
  config,
  network.vpc.privateSubnetIds,
  network.dbSecurityGroup.id
);

// Create cache
const cache = createCache(
  config,
  network.vpc.privateSubnetIds,
  network.redisSecurityGroup.id
);

// Create secrets manager
const secrets = createSecretsManager({
  dbEndpoint: database.instance.endpoint,
  dbPassword: database.password,
  redisHost: cache.cluster.cacheNodes[0].address,
  environment: config.environment,
});

// Create load balancer
const loadBalancer = createLoadBalancer(
  network.vpc.vpcId,
  network.vpc.publicSubnetIds,
  config.environment
);

// Create container service
const container = createContainerService({
  config,
  privateSubnetIds: network.vpc.privateSubnetIds,
  securityGroupIds: pulumi.all([network.appSecurityGroup.id]).apply((ids) => ids),
  targetGroupArn: loadBalancer.targetGroup.arn,
  secretArn: secrets.arn,
  listener: loadBalancer.listener,
});

// Exports
export const vpcId = network.vpc.vpcId;
export const dbEndpoint = database.instance.endpoint;
export const redisEndpoint = cache.cluster.cacheNodes[0].address;
export const albDns = loadBalancer.alb.loadBalancer.apply((lb) => lb.dnsName);
export const clusterName = container.cluster.name;
export const serviceUrl = pulumi.interpolate`https://${config.domain}`;
export const repositoryUrl = container.repository.url;
