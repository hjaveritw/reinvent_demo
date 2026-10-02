import { Stack, type StackProps, aws_wafv2 as waf } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { baselineRules } from './waf';

/** us-east-1: CloudFront-scoped WAF web ACL (CloudFront requires global ACLs to live in us-east-1). */
export class EdgeStack extends Stack {
  readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const acl = new waf.CfnWebACL(this, 'CloudFrontWebAcl', {
      name: 'ats-cloudfront-acl',
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      // Monaco/Motion bundles and API JSON bodies can trip the generic body-size rule; the API has its own limits.
      rules: baselineRules(2000, { excludeCommon: ['SizeRestrictions_BODY'] }),
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'ats-cloudfront-acl', sampledRequestsEnabled: true },
    });
    this.webAclArn = acl.attrArn;
  }
}
