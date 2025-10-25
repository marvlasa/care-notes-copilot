import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface SecretConfig {
  dbEndpoint: pulumi.Output<string>;
  dbPassword: pulumi.Output<string>;
  redisHost: pulumi.Output<string>;
  environment: string;
}

export function createSecretsManager(config: SecretConfig): aws.secretsmanager.Secret {
  const pulumiConfig = new pulumi.Config();

  const secret = new aws.secretsmanager.Secret("app-secrets", {
    name: `carenotes/${config.environment}/env`,
    tags: { Environment: config.environment },
  });

  const secretValue = pulumi
    .all([config.dbEndpoint, config.redisHost, config.dbPassword])
    .apply(([dbEndpoint, redisHost, dbPassword]) =>
      JSON.stringify({
        DATABASE_URL: `postgresql://carenotes:${dbPassword}@${dbEndpoint}/carenotes`,
        REDIS_URL: `redis://${redisHost}:6379`,
        OPENAI_API_KEY: pulumiConfig.requireSecret("openaiApiKey"),
        JWT_SECRET: pulumiConfig.requireSecret("jwtSecret"),
        LANGFUSE_PUBLIC_KEY: pulumiConfig.get("langfusePublicKey") || "",
        LANGFUSE_SECRET_KEY: pulumiConfig.getSecret("langfuseSecretKey") || "",
        SENTRY_DSN: pulumiConfig.get("sentryDsn") || "",
      })
    );

  new aws.secretsmanager.SecretVersion("app-secrets-version", {
    secretId: secret.id,
    secretString: secretValue,
  });

  return secret;
}

