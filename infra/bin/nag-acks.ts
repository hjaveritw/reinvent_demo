import { Validations, type Stack } from 'aws-cdk-lib';

/** cdk-nag findings reviewed on 2026-10-02; each acknowledged with its justification. */
const REVIEWED: { id: string; reason: string }[] = [
  {
    "id": "AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]",
    "reason": "AWS-recommended minimum Lambda logging policy."
  },
  {
    "id": "AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs]",
    "reason": "Required account-level role for API Gateway access/execution logging."
  },
  {
    "id": "AwsSolutions-IAM5[Action::kms:GenerateDataKey*]",
    "reason": "KMS data-key operations on our own CMK only (grant pattern)."
  },
  {
    "id": "AwsSolutions-IAM5[Action::kms:ReEncrypt*]",
    "reason": "KMS data-key operations on our own CMK only (grant pattern)."
  },
  {
    "id": "AwsSolutions-IAM5[Action::s3:Abort*]",
    "reason": "CDK grantRead/ReadWrite on our own artifact/web buckets only (scoped to bucket ARN)."
  },
  {
    "id": "AwsSolutions-IAM5[Action::s3:DeleteObject*]",
    "reason": "CDK grantRead/ReadWrite on our own artifact/web buckets only (scoped to bucket ARN)."
  },
  {
    "id": "AwsSolutions-IAM5[Action::s3:GetBucket*]",
    "reason": "CDK grantRead/ReadWrite on our own artifact/web buckets only (scoped to bucket ARN)."
  },
  {
    "id": "AwsSolutions-IAM5[Action::s3:GetObject*]",
    "reason": "CDK grantRead/ReadWrite on our own artifact/web buckets only (scoped to bucket ARN)."
  },
  {
    "id": "AwsSolutions-IAM5[Action::s3:List*]",
    "reason": "CDK grantRead/ReadWrite on our own artifact/web buckets only (scoped to bucket ARN)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::*]",
    "reason": "X-Ray PutTraceSegments and Step Functions/Logs delivery APIs do not support resource-level permissions."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<ArtifactBucket7410C9EF.Arn>/*]",
    "reason": "Object-level access within the 24h-purge artifact bucket."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<BeforeBuildFn5252C5E8.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<CodeBuildLogs2297454D.Arn>:log-stream:*]",
    "reason": "RecordBuild reads log streams of the sandbox build log group only."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<FinalizeFnAABCAC3B.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<ForwardFn72B7EF1C.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<ModernizationTable45CB52E1.Arn>/index/*]",
    "reason": "Access to the table GSI (GSI1) for status queries."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<RecordBuildFn1AE18FB0.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<ReverseFn6DCA3A43.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<ScanFnD716F44F.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<SelfHealFn2B1BEEC9.Arn>:*]",
    "reason": "Step Functions invokes specific Lambda functions and their versions (Arn:*)."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::<WebBucket12880F5B.Arn>/*]",
    "reason": "BucketDeployment writes static web assets into the private web bucket."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:codebuild:eu-central-1:220686507915:report-group/<SandboxBuild51FE4A8A>-*]",
    "reason": "CodeBuild report groups scoped to the project name prefix."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:ec2:<AWS::Region>:<AWS::AccountId>:network-interface/*]",
    "reason": "CodeBuild VPC mode must manage ENIs; condition-scoped by CDK to the subnets."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:execute-api:eu-central-1:220686507915:<TelemetryWsApi1CEAD015>/*/*/@connections/*]",
    "reason": "WebSocket handler may post only to connections of this API."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:logs:eu-central-1:220686507915:log-group:/aws/codebuild/<SandboxBuild51FE4A8A>:*]",
    "reason": "CodeBuild-managed log permissions for its own project log group."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::arn:<AWS::Partition>:s3:::cdk-atsdemo-assets-220686507915-eu-central-1/*]",
    "reason": "BucketDeployment reads its asset from the CDK bootstrap asset bucket."
  },
  {
    "id": "AwsSolutions-IAM5[Resource::arn:aws:bedrock:eu-*::foundation-model/anthropic.claude-sonnet-5-5]",
    "reason": "EU cross-region inference profile routes to the same model in any EU region; restricted to one model id."
  },
  {
    "id": "AwsSolutions::AwsSolutions-APIG2",
    "reason": "Single authenticated proxy route; bodies are size-limited and schema-validated with zod in the handler."
  },
  {
    "id": "AwsSolutions::AwsSolutions-APIG4",
    "reason": "WebSocket authorization is enforced on $connect (Cognito JWT Lambda authorizer); subsequent routes ride the authorized connection."
  },
  {
    "id": "AwsSolutions::AwsSolutions-CB5",
    "reason": "Rule cannot evaluate tokenized image URI; image is our own hermetic ECR image built from sandbox-image/."
  },
  {
    "id": "AwsSolutions::AwsSolutions-CFR1",
    "reason": "Global demo audience; access restricted by Cognito MFA + WAF rather than geography."
  },
  {
    "id": "AwsSolutions::AwsSolutions-CFR4",
    "reason": "Default *.cloudfront.net certificate (no custom domain requested); viewer TLS policy cannot be pinned without ACM cert. Origin is TLS1.2+."
  },
  {
    "id": "AwsSolutions::AwsSolutions-EC23",
    "reason": "Ingress limited to the VPC CIDR on 443 (token not resolvable at synth); no 0.0.0.0/0 ingress exists."
  },
  {
    "id": "AwsSolutions::AwsSolutions-L1",
    "reason": "CDK-managed BucketDeployment/custom-resource Lambda pins its own runtime; app Lambdas use Node.js 24."
  },
  {
    "id": "AwsSolutions::AwsSolutions-SMG4",
    "reason": "Origin-verify header secret is defence-in-depth behind Cognito auth; rotated on redeploy."
  },
  {
    "id": "Construct-Annotations::@aws-cdk/core:crossStackReferencesDefaultStrong",
    "reason": "Strong cross-stack references intentionally protect the WAF ACL consumed by CloudFront."
  }
];

export function acknowledgeReviewedFindings(main: Stack, edge: Stack) {
  for (const s of [main, edge]) Validations.of(s).acknowledge(...REVIEWED);
}
