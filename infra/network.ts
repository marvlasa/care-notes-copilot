import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface NetworkResources {
  vpc: awsx.ec2.Vpc;
  dbSecurityGroup: aws.ec2.SecurityGroup;
  redisSecurityGroup: aws.ec2.SecurityGroup;
  appSecurityGroup: aws.ec2.SecurityGroup;
}

export function createNetwork(stack: string): NetworkResources {
  // Create VPC
  const vpc = new awsx.ec2.Vpc("carenotes-vpc", {
    numberOfAvailabilityZones: 2,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: { Name: `carenotes-${stack}`, Environment: stack },
  });

  // Database Security Group
  const dbSecurityGroup = new aws.ec2.SecurityGroup("db-sg", {
    vpcId: vpc.vpcId,
    description: "Allow PostgreSQL access from VPC",
    ingress: [
      {
        protocol: "tcp",
        fromPort: 5432,
        toPort: 5432,
        cidrBlocks: [vpc.vpc.cidrBlock],
      },
    ],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    tags: { Name: `carenotes-db-sg-${stack}` },
  });

  // Redis Security Group
  const redisSecurityGroup = new aws.ec2.SecurityGroup("redis-sg", {
    vpcId: vpc.vpcId,
    description: "Allow Redis access from VPC",
    ingress: [
      {
        protocol: "tcp",
        fromPort: 6379,
        toPort: 6379,
        cidrBlocks: [vpc.vpc.cidrBlock],
      },
    ],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    tags: { Name: `carenotes-redis-sg-${stack}` },
  });

  // Application Security Group
  const appSecurityGroup = new aws.ec2.SecurityGroup("app-sg", {
    vpcId: vpc.vpcId,
    description: "Allow HTTP/HTTPS traffic to app",
    ingress: [
      {
        protocol: "tcp",
        fromPort: 3000,
        toPort: 3000,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    egress: [
      {
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
      },
    ],
    tags: { Name: `carenotes-app-sg-${stack}` },
  });

  return { vpc, dbSecurityGroup, redisSecurityGroup, appSecurityGroup };
}

