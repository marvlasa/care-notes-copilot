import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import type { AppConfig } from "./config";

export interface DatabaseResources {
  instance: aws.rds.Instance;
  password: pulumi.Output<string>;
}

export function createDatabase(
  config: AppConfig,
  subnetIds: pulumi.Output<string[]>,
  securityGroupId: pulumi.Output<string>
): DatabaseResources {
  const pulumiConfig = new pulumi.Config();
  const password = pulumiConfig.requireSecret("dbPassword");

  const subnetGroup = new aws.rds.SubnetGroup("db-subnet-group", {
    subnetIds,
    tags: { Name: `carenotes-db-subnet-${config.environment}` },
  });

  const instance = new aws.rds.Instance("carenotes-db", {
    engine: "postgres",
    engineVersion: "16.1",
    instanceClass: config.dbInstanceClass,
    allocatedStorage: 20,
    storageType: "gp3",
    dbName: "carenotes",
    username: "carenotes",
    password,
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [securityGroupId],
    skipFinalSnapshot: !config.isProd,
    backupRetentionPeriod: config.isProd ? 7 : 1,
    multiAz: config.isProd,
    tags: {
      Name: `carenotes-db-${config.environment}`,
      Environment: config.environment,
    },
  });

  return { instance, password };
}

