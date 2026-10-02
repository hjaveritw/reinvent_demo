import { App, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { acknowledgeReviewedFindings } from './nag-acks';
import { AppStack } from '../lib/app-stack';
import { EdgeStack } from '../lib/edge-stack';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT ?? '220686507915';
const region = 'eu-central-1';

const edge = new EdgeStack(app, 'AtsEdgeStack', { env: { account, region: 'us-east-1' }, crossRegionReferences: true });
const main = new AppStack(app, 'AtsAppStack', {
  env: { account, region },
  crossRegionReferences: true,
  cloudFrontWebAclArn: edge.webAclArn,
  modelId: app.node.tryGetContext('modelId'),
  modelName: app.node.tryGetContext('modelName'),
  adminEmail: app.node.tryGetContext('adminEmail') || undefined,
  enableGuardrail: app.node.tryGetContext('guardrail') !== 'false',
});
main.addDependency(edge);

for (const s of [edge, main]) {
  Tags.of(s).add('Project', 'aws-transform-modernization-studio');
  Tags.of(s).add('DataClassification', 'confidential-zdr-24h');
}

Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
acknowledgeReviewedFindings(main, edge);
