const str = { type: 'string' };
const strArr = { type: 'array', items: str };
const severity = { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] };
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required });

export const RESS_SCHEMA = obj({
  projectName: str,
  summary: str,
  topology: obj({
    components: { type: 'array', items: obj({ name: str, kind: str, responsibility: str, files: strArr }) },
    boundaries: { type: 'array', items: obj({ from: str, to: str, protocol: str, description: str }) },
  }),
  stateMachines: { type: 'array', items: obj({ name: str, states: strArr, transitions: { type: 'array', items: obj({ from: str, to: str, trigger: str }) } }) },
  businessRules: {
    type: 'array',
    items: obj({
      id: str,
      category: { type: 'string', enum: ['physics', 'timing', 'scoring', 'validation', 'financial', 'security', 'data'] },
      title: str,
      rule: str,
      source: obj({ file: str, lines: str }),
      parityTest: str,
    }),
  },
  timing: obj({ model: str, tickHz: { type: 'number' }, tickMs: { type: 'number' }, notes: str }, ['model', 'notes']),
  protocols: {
    type: 'array',
    items: obj({
      name: str,
      transport: str,
      messages: { type: 'array', items: obj({ code: str, name: str, direction: str, legacyLayout: str, modernEvent: str }) },
      issues: strArr,
    }),
  },
  vulnerabilities: { type: 'array', items: obj({ id: str, severity, component: str, description: str, remediation: str }) },
  concurrencyIssues: { type: 'array', items: obj({ location: str, issue: str, remediation: str }) },
  complianceFindings: { type: 'array', items: obj({ control: str, file: str, finding: str, remediation: str }) },
  modernizationPlan: { type: 'array', items: obj({ recipe: str, description: str, targets: strArr }) },
});

const fileSchema = obj({ path: str, content: str });
const annotationSchema = obj({
  modernPath: str,
  legacyPath: { type: ['string', 'null'] },
  summary: str,
  recipes: { type: 'array', items: obj({ recipeId: str, line: { type: 'integer' }, note: str }, ['recipeId', 'note']) },
});

export const CODEGEN_SCHEMA = obj({
  files: { type: 'array', items: fileSchema, description: 'Complete file contents. Paths relative to project root, e.g. src/main/java/...' },
  annotations: { type: 'array', items: annotationSchema },
});

export const FIX_SCHEMA = obj({
  diagnosis: str,
  files: { type: 'array', items: fileSchema, description: 'Full replacement contents of every file you change or add.' },
  deletePaths: strArr,
}, ['diagnosis', 'files']);
