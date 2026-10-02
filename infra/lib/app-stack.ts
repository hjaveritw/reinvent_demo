import * as path from 'node:path';
import {
  CfnOutput, Duration, RemovalPolicy, Stack, type StackProps,
  aws_apigateway as apigw,
  aws_apigatewayv2 as apigwv2,
  aws_apigatewayv2_authorizers as apigwv2Auth,
  aws_apigatewayv2_integrations as apigwv2Int,
  aws_bedrock as bedrock,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_cloudwatch as cw,
  aws_codebuild as codebuild,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_ec2 as ec2,
  aws_ecr_assets as ecrAssets,
  aws_iam as iam,
  aws_kms as kms,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_logs as logs,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_secretsmanager as secrets,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  aws_wafv2 as waf,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { baselineRules } from './waf';

export interface AppStackProps extends StackProps {
  cloudFrontWebAclArn: string;
  modelId: string;
  modelName: string;
  adminEmail?: string;
  enableGuardrail: boolean;
}

const ROOT = path.join(__dirname, '..', '..');
const ORIGIN_HEADER = 'x-ats-origin-verify';

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------- encryption
    const dataKey = new kms.Key(this, 'DataKey', {
      alias: 'alias/ats/data',
      description: 'AWS Transform Studio data-at-rest CMK (DynamoDB, S3, logs, CodeBuild)',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });
    dataKey.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal(`logs.${this.region}.amazonaws.com`)],
      actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
      resources: ['*'],
      conditions: { ArnLike: { 'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${this.region}:${this.account}:log-group:*` } },
    }));

    const signingKey = new kms.Key(this, 'AttestationSigningKey', {
      alias: 'alias/ats/attestation-signing',
      description: 'ECDSA P-256 key signing in-toto/SLSA provenance for approved modernizations',
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7),
    });

    const logGroup = (name: string, encrypted = true) => new logs.LogGroup(this, `${name}Logs`, {
      retention: logs.RetentionDays.ONE_MONTH,
      encryptionKey: encrypted ? dataKey : undefined,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------------------------------------------------------------- storage
    const accessLogs = new s3.Bucket(this, 'AccessLogBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED, // required by CloudFront standard logging
      lifecycleRules: [{ expiration: Duration.days(90) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const artifacts = new s3.Bucket(this, 'ArtifactBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dataKey,
      bucketKeyEnabled: true,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      serverAccessLogsBucket: accessLogs,
      serverAccessLogsPrefix: 'artifacts/',
      // COMP-SOC2-01 / NFR-02: code, specs and build logs auto-purge (1 day = S3 minimum granularity, meets 24h).
      lifecycleRules: [{ id: 'zdr-24h-purge', expiration: Duration.days(1), abortIncompleteMultipartUploadAfter: Duration.days(1) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      serverAccessLogsBucket: accessLogs,
      serverAccessLogsPrefix: 'web/',
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const table = new dynamodb.TableV2(this, 'ModernizationTable', {
      tableName: 'ats-modernization',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      globalSecondaryIndexes: [{
        indexName: 'GSI1',
        partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      }],
      billing: dynamodb.Billing.onDemand(),
      encryption: dynamodb.TableEncryptionV2.customerManagedKey(dataKey),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------------------------------------------------------------- identity
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'ats-users',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },
      passwordPolicy: { minLength: 14, requireDigits: true, requireLowercase: true, requireUppercase: true, requireSymbols: true, tempPasswordValidity: Duration.days(3) },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      featurePlan: cognito.FeaturePlan.PLUS,
      standardThreatProtectionMode: cognito.StandardThreatProtectionMode.FULL_FUNCTION,
      userInvitation: {
        emailSubject: 'Your AWS Transform Modernization Studio access',
        emailBody: 'You have been invited to the AWS Transform Modernization Studio. Username: {username} Temporary password: {####} — you will be asked to set a new password and enrol an authenticator app (TOTP) at first sign-in.',
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: 'ats-web',
      authFlows: { userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(30),
      idTokenValidity: Duration.minutes(30),
      refreshTokenValidity: Duration.hours(8),
    });
    if (props.adminEmail) {
      new cognito.CfnUserPoolUser(this, 'AdminUser', {
        userPoolId: userPool.userPoolId,
        username: props.adminEmail,
        desiredDeliveryMediums: ['EMAIL'],
        userAttributes: [{ name: 'email', value: props.adminEmail }, { name: 'email_verified', value: 'true' }],
      });
    }

    // ---------------------------------------------------------------- isolated build sandbox (no NAT, no IGW)
    const vpc = new ec2.Vpc(this, 'SandboxVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'sandbox', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 }],
      flowLogs: { all: { destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup('VpcFlow')), trafficType: ec2.FlowLogTrafficType.ALL } },
      restrictDefaultSecurityGroup: true,
    });
    vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    const endpointSg = new ec2.SecurityGroup(this, 'EndpointSg', { vpc, allowAllOutbound: false, description: 'Interface endpoints: HTTPS from sandbox only' });
    endpointSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443), 'HTTPS from VPC');
    for (const [name, service] of Object.entries({
      Logs: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      EcrApi: ec2.InterfaceVpcEndpointAwsService.ECR,
      EcrDkr: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      Kms: ec2.InterfaceVpcEndpointAwsService.KMS,
    })) {
      vpc.addInterfaceEndpoint(`${name}Endpoint`, { service, securityGroups: [endpointSg], privateDnsEnabled: true });
    }
    const buildSg = new ec2.SecurityGroup(this, 'BuildSg', { vpc, allowAllOutbound: false, description: 'CodeBuild sandbox: egress only to VPC endpoints' });
    buildSg.addEgressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443), 'VPC interface endpoints');
    buildSg.addEgressRule(ec2.Peer.prefixList('pl-6ea54007'), ec2.Port.tcp(443), 'S3 gateway endpoint (eu-central-1 prefix list)');

    const sandboxImage = new ecrAssets.DockerImageAsset(this, 'SandboxImage', {
      directory: path.join(ROOT, 'sandbox-image'),
      platform: ecrAssets.Platform.LINUX_ARM64,
    });

    const buildLogs = logGroup('CodeBuild');
    const buildProject = new codebuild.Project(this, 'SandboxBuild', {
      projectName: 'ats-sandbox-build',
      description: 'Hermetic, VPC-isolated compile + parity test of forward-engineered code (offline Maven, -Werror)',
      source: codebuild.Source.s3({ bucket: artifacts, path: 'bootstrap/placeholder.zip' }),
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.fromEcrRepository(sandboxImage.repository, sandboxImage.imageTag),
        computeType: codebuild.ComputeType.LARGE,
        privileged: false,
      },
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [buildSg],
      encryptionKey: dataKey,
      timeout: Duration.minutes(15),
      queuedTimeout: Duration.minutes(10),
      logging: { cloudWatch: { logGroup: buildLogs } },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: { shell: 'bash', variables: { MAVEN_OPTS: '-Xmx3g -XX:TieredStopAtLevel=1' } },
        phases: {
          build: {
            commands: [
              'echo "SANDBOX java=$(java -version 2>&1 | head -1) maven=$(mvn -v | head -1) job=$JOB_ID attempt=$ATTEMPT"',
              'echo "SANDBOX network egress: $(timeout 3 bash -c "</dev/tcp/repo.maven.apache.org/443" 2>/dev/null && echo OPEN || echo BLOCKED)"',
              'set -o pipefail; mvn -B -o -ntp -Dstyle.color=never verify 2>&1 | tee /tmp/build.log',
              'WARN=$(grep -cE "^\\[WARNING\\] .*\\.java" /tmp/build.log || true); echo "COMPILER_WARNINGS=$WARN"; test "$WARN" -eq 0',
            ],
          },
          post_build: {
            commands: [
              'BEFORE=$(du -sk "$CODEBUILD_SRC_DIR" | cut -f1)',
              'rm -rf "$CODEBUILD_SRC_DIR"/* "$CODEBUILD_SRC_DIR"/.[!.]* /tmp/build.log /root/.m2/repository/com/cyberrunner /root/.m2/repository/com/acmebank 2>/dev/null || true',
              'echo "ZDR-PURGE workspace_kb_before=$BEFORE residual_entries=$(find "$CODEBUILD_SRC_DIR" -mindepth 1 | wc -l)"',
            ],
          },
        },
      }),
    });
    artifacts.grantRead(buildProject);

    // ---------------------------------------------------------------- Bedrock guardrail
    let guardrailEnv: Record<string, string> = {};
    let guardrailArn: string | undefined;
    if (props.enableGuardrail) {
      const guardrail = new bedrock.CfnGuardrail(this, 'Guardrail', {
        name: 'ats-modernization-guardrail',
        blockedInputMessaging: 'Input blocked by the modernization guardrail.',
        blockedOutputsMessaging: 'Output blocked by the modernization guardrail.',
        contentPolicyConfig: { filtersConfig: [{ type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' }] },
      });
      const version = new bedrock.CfnGuardrailVersion(this, 'GuardrailVersion', { guardrailIdentifier: guardrail.attrGuardrailId });
      guardrailEnv = { GUARDRAIL_ID: guardrail.attrGuardrailId, GUARDRAIL_VERSION: version.attrVersion };
      guardrailArn = guardrail.attrGuardrailArn;
    }

    // ---------------------------------------------------------------- Lambda functions
    const fn = (id: string, entry: string, handler: string, opts: { timeout?: Duration; memory?: number; env?: Record<string, string> } = {}) => new nodejs.NodejsFunction(this, id, {
      entry: path.join(ROOT, 'services', 'src', 'handlers', entry),
      handler,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: opts.memory ?? 1024,
      timeout: opts.timeout ?? Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: dataKey,
      logGroup: logGroup(id),
      depsLockFilePath: path.join(ROOT, 'package-lock.json'),
      projectRoot: ROOT,
      bundling: { minify: true, sourceMap: true, target: 'node22', externalModules: [] },
      environment: { NODE_OPTIONS: '--enable-source-maps', TABLE_NAME: table.tableName, ARTIFACT_BUCKET: artifacts.bucketName, ...opts.env },
    });

    const bedrockPolicy = new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${props.modelId}`,
        `arn:aws:bedrock:eu-*::foundation-model/${props.modelName}`,
      ],
    });
    const llmEnv = { MODEL_ID: props.modelId, ...guardrailEnv };

    const scanFn = fn('ScanFn', 'pipeline.ts', 'scan');
    const reverseFn = fn('ReverseFn', 'pipeline.ts', 'reverseEngineer', { timeout: Duration.minutes(10), env: llmEnv });
    const forwardFn = fn('ForwardFn', 'pipeline.ts', 'forwardEngineer', { timeout: Duration.minutes(15), memory: 1536, env: llmEnv });
    const beforeBuildFn = fn('BeforeBuildFn', 'pipeline.ts', 'beforeBuild');
    const recordBuildFn = fn('RecordBuildFn', 'pipeline.ts', 'recordBuild', { timeout: Duration.minutes(2), env: { BUILD_PROJECT: buildProject.projectName } });
    const healFn = fn('SelfHealFn', 'pipeline.ts', 'selfHeal', { timeout: Duration.minutes(15), memory: 1536, env: llmEnv });
    const finalizeFn = fn('FinalizeFn', 'pipeline.ts', 'finalize');

    for (const f of [scanFn, reverseFn, forwardFn, beforeBuildFn, recordBuildFn, healFn, finalizeFn]) {
      table.grantReadWriteData(f);
      artifacts.grantReadWrite(f);
    }
    for (const f of [reverseFn, forwardFn, healFn]) {
      f.addToRolePolicy(bedrockPolicy);
      if (guardrailArn) f.addToRolePolicy(new iam.PolicyStatement({ actions: ['bedrock:ApplyGuardrail'], resources: [guardrailArn] }));
    }
    recordBuildFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['codebuild:BatchGetBuilds', 'codebuild:ListBuildsForProject'], resources: [buildProject.projectArn] }));
    buildLogs.grantRead(recordBuildFn);
    recordBuildFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['logs:GetLogEvents'], resources: [`${buildLogs.logGroupArn}:log-stream:*`] }));

    // ---------------------------------------------------------------- Step Functions orchestration
    const invoke = (id: string, f: lambda.IFunction) => new tasks.LambdaInvoke(this, id, { lambdaFunction: f, payloadResponseOnly: true, retryOnServiceExceptions: true });
    const finalize = invoke('Finalize', finalizeFn);
    const markFailed = new sfn.Pass(this, 'MarkFailed', { result: sfn.Result.fromBoolean(true), resultPath: '$.failed' }).next(finalize);
    const withCatch = <T extends tasks.LambdaInvoke>(t: T) => {
      t.addCatch(markFailed, { resultPath: '$.error' });
      return t;
    };
    const llmRetry = { errors: ['ThrottlingException', 'ServiceUnavailableException', 'ModelNotReadyException'], interval: Duration.seconds(10), maxAttempts: 3, backoffRate: 2 };

    const scanTask = withCatch(invoke('Scan', scanFn));
    const reverseTask = withCatch(invoke('ReverseEngineer', reverseFn));
    reverseTask.addRetry(llmRetry);
    const forwardTask = withCatch(invoke('ForwardEngineer', forwardFn));
    forwardTask.addRetry(llmRetry);
    const beforeBuild = withCatch(invoke('BeforeBuild', beforeBuildFn));
    const recordBuild = withCatch(invoke('RecordBuild', recordBuildFn));
    const selfHeal = withCatch(invoke('SelfHeal', healFn));
    selfHeal.addRetry(llmRetry);

    const startBuild = new sfn.CustomState(this, 'SandboxBuild.sync', {
      stateJson: {
        Type: 'Task',
        Resource: `arn:${this.partition}:states:::codebuild:startBuild.sync`,
        Parameters: {
          ProjectName: buildProject.projectName,
          SourceTypeOverride: 'S3',
          'SourceLocationOverride.$': '$.sourceLocation',
          EnvironmentVariablesOverride: [
            { Name: 'JOB_ID', Type: 'PLAINTEXT', 'Value.$': '$.jobId' },
            { Name: 'ATTEMPT', Type: 'PLAINTEXT', 'Value.$': "States.Format('{}', $.attempt)" },
          ],
        },
        ResultSelector: { Build: { 'Id.$': '$.Build.Id', 'BuildStatus.$': '$.Build.BuildStatus' } },
        ResultPath: '$.build',
      },
    });
    startBuild.addCatch(recordBuild, { errors: ['States.ALL'], resultPath: '$.buildError' });

    const afterBuild = new sfn.Choice(this, 'BuildSucceeded?')
      .when(sfn.Condition.booleanEquals('$.buildResult.succeeded', true), finalize)
      .when(sfn.Condition.numberLessThan('$.attempt', 3), selfHeal.next(beforeBuild))
      .otherwise(finalize);

    const definition = scanTask
      .next(reverseTask)
      .next(forwardTask)
      .next(beforeBuild)
      .next(startBuild)
      .next(recordBuild)
      .next(afterBuild);

    const stateMachine = new sfn.StateMachine(this, 'ModernizationPipeline', {
      stateMachineName: 'ats-modernization-pipeline',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: Duration.hours(1),
      tracingEnabled: true,
      logs: { destination: logGroup('StateMachine'), level: sfn.LogLevel.ALL, includeExecutionData: false },
    });
    stateMachine.addToRolePolicy(new iam.PolicyStatement({ actions: ['codebuild:StartBuild', 'codebuild:StopBuild', 'codebuild:BatchGetBuilds', 'codebuild:BatchGetReports'], resources: [buildProject.projectArn] }));
    stateMachine.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
      resources: [`arn:${this.partition}:events:${this.region}:${this.account}:rule/StepFunctionsGetEventForCodeBuildStartBuildRule`],
    }));

    // ---------------------------------------------------------------- REST API (Cognito-protected, regional WAF, reached via CloudFront)
    const apiFn = fn('ApiFn', 'api.ts', 'handler', {
      timeout: Duration.seconds(29),
      env: { STATE_MACHINE_ARN: stateMachine.stateMachineArn, SIGNING_KEY_ID: signingKey.keyId, BUILD_PROJECT_ARN: buildProject.projectArn },
    });
    table.grantReadWriteData(apiFn);
    artifacts.grantReadWrite(apiFn);
    stateMachine.grantStartExecution(apiFn);
    apiFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['kms:Sign', 'kms:Verify', 'kms:GetPublicKey'], resources: [signingKey.keyArn] }));

    const api = new apigw.RestApi(this, 'RestApi', {
      restApiName: 'ats-api',
      endpointTypes: [apigw.EndpointType.REGIONAL],
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: RemovalPolicy.RETAIN,
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        metricsEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false,
        throttlingRateLimit: 25,
        throttlingBurstLimit: 50,
        accessLogDestination: new apigw.LogGroupLogDestination(logGroup('ApiAccess')),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
      },
      disableExecuteApiEndpoint: false,
    });
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', { cognitoUserPools: [userPool], resultsCacheTtl: Duration.minutes(5) });
    const validator = api.addRequestValidator('BodyValidator', { validateRequestBody: false, validateRequestParameters: true });
    api.root.addResource('api').addResource('{proxy+}').addMethod('ANY', new apigw.LambdaIntegration(apiFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizationScopes: ['aws.cognito.signin.user.admin'],
      requestValidator: validator,
    });

    // Shared secret header proves requests came through CloudFront (+ its WAF); enforced by the regional WAF.
    const originSecret = new secrets.Secret(this, 'OriginVerifySecret', {
      description: 'CloudFront → API Gateway origin verification header value',
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
      encryptionKey: dataKey,
    });
    const originSecretValue = originSecret.secretValue.unsafeUnwrap();

    const apiAcl = new waf.CfnWebACL(this, 'ApiWebAcl', {
      name: 'ats-api-acl',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'RequireCloudFrontOrigin',
          priority: 10,
          action: { block: {} },
          statement: {
            notStatement: {
              statement: {
                byteMatchStatement: {
                  fieldToMatch: { singleHeader: { Name: ORIGIN_HEADER } },
                  positionalConstraint: 'EXACTLY',
                  searchString: originSecretValue,
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'RequireCloudFrontOrigin', sampledRequestsEnabled: true },
        },
        ...baselineRules(1000),
      ],
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'ats-api-acl', sampledRequestsEnabled: true },
    });
    new waf.CfnWebACLAssociation(this, 'ApiWebAclAssociation', {
      resourceArn: `arn:${this.partition}:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
      webAclArn: apiAcl.attrArn,
    });

    // ---------------------------------------------------------------- WebSocket telemetry API
    const wsFn = fn('WsFn', 'ws.ts', 'handler', { timeout: Duration.seconds(10), memory: 512 });
    table.grantReadWriteData(wsFn);
    const wsAuthFn = fn('WsAuthorizerFn', 'ws.ts', 'authorize', {
      timeout: Duration.seconds(5),
      memory: 256,
      env: { USER_POOL_ID: userPool.userPoolId, USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId },
    });
    const wsApi = new apigwv2.WebSocketApi(this, 'TelemetryWsApi', {
      apiName: 'ats-telemetry-ws',
      connectRouteOptions: {
        integration: new apigwv2Int.WebSocketLambdaIntegration('ConnectInt', wsFn),
        authorizer: new apigwv2Auth.WebSocketLambdaAuthorizer('WsAuthorizer', wsAuthFn, { identitySource: ['route.request.querystring.token'] }),
      },
      disconnectRouteOptions: { integration: new apigwv2Int.WebSocketLambdaIntegration('DisconnectInt', wsFn) },
      defaultRouteOptions: { integration: new apigwv2Int.WebSocketLambdaIntegration('DefaultInt', wsFn) },
    });
    const wsStage = new apigwv2.WebSocketStage(this, 'TelemetryWsStage', {
      webSocketApi: wsApi,
      stageName: 'prod',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });
    const wsLogs = logGroup('WsAccess');
    (wsStage.node.defaultChild as apigwv2.CfnStage).accessLogSettings = {
      destinationArn: wsLogs.logGroupArn,
      format: JSON.stringify({ requestId: '$context.requestId', ip: '$context.identity.sourceIp', routeKey: '$context.routeKey', status: '$context.status', connectionId: '$context.connectionId', error: '$context.error.message', authorizerError: '$context.authorizer.error' }),
    };
    wsStage.node.addDependency(api.deploymentStage);
    wsApi.grantManageConnections(wsFn);

    // ---------------------------------------------------------------- CloudFront (SPA + /api/* → API Gateway)
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`function handler(event){var r=event.request;if(r.uri.indexOf('.')===-1){r.uri='/index.html';}return r;}`),
    });
    const wsHost = `${wsApi.apiId}.execute-api.${this.region}.amazonaws.com`;
    const headers = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: 'ats-security-headers',
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          override: true,
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            `connect-src 'self' https://cognito-idp.${this.region}.amazonaws.com wss://${wsHost}`,
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
          ].join('; '),
        },
        strictTransportSecurity: { override: true, accessControlMaxAge: Duration.days(730), includeSubdomains: true, preload: true },
        contentTypeOptions: { override: true },
        frameOptions: { override: true, frameOption: cloudfront.HeadersFrameOption.DENY },
        referrerPolicy: { override: true, referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN },
        xssProtection: { override: true, protection: true, modeBlock: true },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()', override: true },
          { header: 'Cross-Origin-Opener-Policy', value: 'same-origin', override: true },
        ],
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'AWS Transform Modernization Studio',
      defaultRootObject: 'index.html',
      webAclId: props.cloudFrontWebAclArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: true,
      logBucket: accessLogs,
      logFilePrefix: 'cloudfront/',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headers,
        functionAssociations: [{ function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${api.restApiId}.execute-api.${this.region}.amazonaws.com`, {
            originPath: `/${api.deploymentStage.stageName}`,
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
            customHeaders: { [ORIGIN_HEADER]: originSecretValue },
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: headers,
        },
      },
    });

    new s3deploy.BucketDeployment(this, 'WebDeployment', {
      destinationBucket: webBucket,
      sources: [
        s3deploy.Source.asset(path.join(ROOT, 'web', 'dist')),
        s3deploy.Source.jsonData('config.json', {
          region: this.region,
          userPoolId: userPool.userPoolId,
          userPoolClientId: userPoolClient.userPoolClientId,
          wsUrl: `wss://${wsHost}/${wsStage.stageName}`,
          modelId: props.modelId,
        }),
      ],
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 512,
    });

    // ---------------------------------------------------------------- alarms
    new cw.Alarm(this, 'PipelineFailuresAlarm', {
      metric: stateMachine.metricFailed({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Modernization pipeline execution failed',
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });
    new cw.Alarm(this, 'Api5xxAlarm', {
      metric: api.metricServerError({ period: Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'API Gateway 5xx errors',
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });

    new CfnOutput(this, 'AppUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'ApiDirectUrl', { value: api.url, description: 'Direct API URL (blocked by WAF without CloudFront origin header)' });
    new CfnOutput(this, 'WebSocketUrl', { value: `wss://${wsHost}/${wsStage.stageName}` });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
    new CfnOutput(this, 'BuildProjectName', { value: buildProject.projectName });
    new CfnOutput(this, 'SandboxVpcId', { value: vpc.vpcId });
    new CfnOutput(this, 'SigningKeyArn', { value: signingKey.keyArn });
  }
}
