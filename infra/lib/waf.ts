import { aws_wafv2 as waf } from 'aws-cdk-lib';

const managed = (name: string, priority: number, excluded: string[] = []): waf.CfnWebACL.RuleProperty => ({
  name,
  priority,
  overrideAction: { none: {} },
  statement: { managedRuleGroupStatement: { vendorName: 'AWS', name, ruleActionOverrides: excluded.map((r) => ({ name: r, actionToUse: { count: {} } })) } },
  visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: name, sampledRequestsEnabled: true },
});

/** AWS managed baseline + per-IP rate limit, shared by the CloudFront and regional (API) web ACLs. */
export function baselineRules(rateLimit: number, opts: { excludeCommon?: string[] } = {}): waf.CfnWebACL.RuleProperty[] {
  return [
    managed('AWSManagedRulesAmazonIpReputationList', 0),
    managed('AWSManagedRulesCommonRuleSet', 1, opts.excludeCommon),
    managed('AWSManagedRulesKnownBadInputsRuleSet', 2),
    {
      name: 'RateLimitPerIp',
      priority: 3,
      action: { block: {} },
      statement: { rateBasedStatement: { limit: rateLimit, aggregateKeyType: 'IP' } },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'RateLimitPerIp', sampledRequestsEnabled: true },
    },
  ];
}
