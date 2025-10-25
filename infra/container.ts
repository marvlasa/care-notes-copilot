import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import type { AppConfig } from "./config";

export interface ContainerResources {
  cluster: aws.ecs.Cluster;
  taskDefinition: aws.ecs.TaskDefinition;
  service: aws.ecs.Service;
  repository: awsx.ecr.Repository;
  image: awsx.ecr.Image;
}

interface ContainerOptions {
  config: AppConfig;
  privateSubnetIds: pulumi.Output<string[]>;
  securityGroupIds: pulumi.Output<string[]>;
  targetGroupArn: pulumi.Output<string>;
  secretArn: pulumi.Output<string>;
  listener: aws.lb.Listener;
}

export function createContainerService(options: ContainerOptions): ContainerResources {
  const { config } = options;

  // ECR Repository
  const repository = new awsx.ecr.Repository("carenotes-repo", {
    forceDelete: !config.isProd,
    tags: { Environment: config.environment },
  });

  // Build and push image
  const image = new awsx.ecr.Image("carenotes-image", {
    repositoryUrl: repository.url,
    context: "..",
    dockerfile: "../Dockerfile",
    platform: "linux/amd64",
  });

  // ECS Cluster
  const cluster = new aws.ecs.Cluster("carenotes-cluster", {
    name: `carenotes-${config.environment}`,
    tags: { Environment: config.environment },
  });

  // IAM Role
  const taskRole = createTaskRole(config.environment);

  // CloudWatch Logs
  const logGroup = new aws.cloudwatch.LogGroup("app-logs", {
    name: `/ecs/carenotes-${config.environment}`,
    retentionInDays: config.isProd ? 30 : 7,
    tags: { Environment: config.environment },
  });

  // Task Definition
  const taskDefinition = new aws.ecs.TaskDefinition("carenotes-task", {
    family: `carenotes-${config.environment}`,
    cpu: config.appCpu.toString(),
    memory: config.appMemory.toString(),
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: taskRole.arn,
    taskRoleArn: taskRole.arn,
    containerDefinitions: pulumi.jsonStringify([
      {
        name: "carenotes",
        image: image.imageUri,
        portMappings: [{ containerPort: 3000 }],
        secrets: [
          {
            name: "DATABASE_URL",
            valueFrom: pulumi.interpolate`${options.secretArn}:DATABASE_URL::`,
          },
          {
            name: "REDIS_URL",
            valueFrom: pulumi.interpolate`${options.secretArn}:REDIS_URL::`,
          },
          {
            name: "OPENAI_API_KEY",
            valueFrom: pulumi.interpolate`${options.secretArn}:OPENAI_API_KEY::`,
          },
          {
            name: "JWT_SECRET",
            valueFrom: pulumi.interpolate`${options.secretArn}:JWT_SECRET::`,
          },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": logGroup.name,
            "awslogs-region": aws.config.region!,
            "awslogs-stream-prefix": "ecs",
          },
        },
      },
    ]),
    tags: { Environment: config.environment },
  });

  // ECS Service
  const service = new aws.ecs.Service(
    "carenotes-service",
    {
      cluster: cluster.arn,
      desiredCount: config.appDesiredCount,
      launchType: "FARGATE",
      taskDefinition: taskDefinition.arn,
      networkConfiguration: {
        subnets: options.privateSubnetIds,
        securityGroups: options.securityGroupIds,
        assignPublicIp: false,
      },
      loadBalancers: [
        {
          targetGroupArn: options.targetGroupArn,
          containerName: "carenotes",
          containerPort: 3000,
        },
      ],
      tags: { Environment: config.environment },
    },
    { dependsOn: [options.listener] }
  );

  // Auto Scaling
  createAutoScaling(cluster, service, config);

  return { cluster, taskDefinition, service, repository, image };
}

function createTaskRole(environment: string): aws.iam.Role {
  const role = new aws.iam.Role("task-role", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "ecs-tasks.amazonaws.com",
    }),
  });

  new aws.iam.RolePolicyAttachment("task-policy", {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AmazonECSTaskExecutionRolePolicy,
  });

  new aws.iam.RolePolicy("secrets-policy", {
    role: role.name,
    policy: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "secretsmanager:GetSecretValue",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          Resource: "*",
        },
      ],
    },
  });

  return role;
}

function createAutoScaling(
  cluster: aws.ecs.Cluster,
  service: aws.ecs.Service,
  config: AppConfig
): void {
  const scalingTarget = new aws.appautoscaling.Target("carenotes-scaling", {
    maxCapacity: 10,
    minCapacity: config.appDesiredCount,
    resourceId: pulumi.interpolate`service/${cluster.name}/${service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
  });

  new aws.appautoscaling.Policy("carenotes-scaling-policy", {
    policyType: "TargetTrackingScaling",
    resourceId: scalingTarget.resourceId,
    scalableDimension: scalingTarget.scalableDimension,
    serviceNamespace: scalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      targetValue: 70,
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageCPUUtilization",
      },
      scaleInCooldown: 300,
      scaleOutCooldown: 60,
    },
  });
}

