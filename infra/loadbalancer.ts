import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export interface LoadBalancerResources {
  alb: awsx.lb.ApplicationLoadBalancer;
  targetGroup: aws.lb.TargetGroup;
  listener: aws.lb.Listener;
}

export function createLoadBalancer(
  vpcId: pulumi.Output<string>,
  publicSubnetIds: pulumi.Output<string[]>,
  environment: string
): LoadBalancerResources {
  const config = new pulumi.Config();

  const alb = new awsx.lb.ApplicationLoadBalancer("carenotes-alb", {
    subnetIds: publicSubnetIds,
    tags: { Name: `carenotes-alb-${environment}`, Environment: environment },
  });

  const targetGroup = new aws.lb.TargetGroup("carenotes-tg", {
    port: 3000,
    protocol: "HTTP",
    targetType: "ip",
    vpcId,
    healthCheck: {
      path: "/api/health",
      interval: 30,
      timeout: 5,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
    },
    tags: { Environment: environment },
  });

  const listener = new aws.lb.Listener("carenotes-listener", {
    loadBalancerArn: alb.loadBalancer.arn,
    port: 443,
    protocol: "HTTPS",
    sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
    certificateArn: config.require("certificateArn"),
    defaultActions: [
      {
        type: "forward",
        targetGroupArn: targetGroup.arn,
      },
    ],
  });

  return { alb, targetGroup, listener };
}

