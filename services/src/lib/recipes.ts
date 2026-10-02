export interface Recipe {
  id: string;
  title: string;
  kind: 'deterministic' | 'generative';
  description: string;
  control?: string;
}

/** AWS Transform-style recipe catalog. Deterministic = AST/OpenRewrite-equivalent; generative = LLM-assisted. */
export const RECIPES: Recipe[] = [
  { id: 'R-JAKARTA', title: 'javax → jakarta namespace', kind: 'deterministic', description: 'Migrates javax.servlet/persistence/validation imports to Jakarta EE 10 equivalents.' },
  { id: 'R-BOOT3', title: 'Spring Boot 3.3.4 / Java 21 baseline', kind: 'deterministic', description: 'Replaces hand-managed dependencies with the Spring Boot 3.3.4 BOM on Java 21 LTS, removing EOL and vulnerable libraries.' },
  { id: 'R-VTHREADS', title: 'Thread.sleep loop → virtual-thread scheduler', kind: 'deterministic', description: 'Replaces busy while/Thread.sleep loops with a fixed-rate ScheduledExecutorService on virtual threads.' },
  { id: 'R-LOCKS', title: 'synchronized → ReentrantLock', kind: 'deterministic', description: 'Removes monitor locks that pin virtual threads; uses java.util.concurrent locks with try/finally.' },
  { id: 'R-COLLECTIONS', title: 'Legacy collections → java.util modern types', kind: 'deterministic', description: 'Vector/Hashtable/StringBuffer/raw types → List/Map/StringBuilder/records with generics.' },
  { id: 'R-STOMP', title: 'Raw socket protocol → STOMP over WebSocket', kind: 'generative', description: 'Maps binary socket packets to typed JSON events on an authenticated Spring WebSocket broker.' },
  { id: 'R-JPA', title: 'String-built JDBC → Spring Data JPA', kind: 'deterministic', description: 'Replaces Statement + string concatenation (CWE-89) with parameterized repository queries.', control: 'CWE-89' },
  { id: 'R-SECRETS', title: 'Hardcoded secrets → AWS Secrets Manager', kind: 'deterministic', description: 'Removes cleartext credentials; values are injected from Secrets Manager at runtime.', control: 'COMP-GDPR-01' },
  { id: 'R-SHA256', title: 'MD5 / SHA-1 → SHA-256 / AES-GCM', kind: 'deterministic', description: 'Replaces deprecated digests with FIPS 140-3 approved primitives.', control: 'COMP-FEDRAMP-01' },
  { id: 'R-SLF4J-MASK', title: 'Log4j concat logging → SLF4J parameterized + masking', kind: 'deterministic', description: 'Rewrites string-concatenated log statements; removes or masks PII, IPs and credentials.', control: 'COMP-GDPR-02' },
  { id: 'R-PAN-TOKEN', title: 'PAN tokenization', kind: 'generative', description: 'Never stores or logs PANs; compares SHA-256 tokens and validates Luhn.', control: 'COMP-PCI-01' },
  { id: 'R-FIELD-ENCRYPT', title: 'JPA AES-256-GCM attribute encryption', kind: 'generative', description: 'Encrypts sensitive columns at rest with an AttributeConverter.', control: 'COMP-HIPAA-01' },
  { id: 'R-AUDIT', title: 'Auditing entity listeners', kind: 'deterministic', description: 'Adds @EntityListeners(AuditingEntityListener) and audit timestamps to mutable entities.', control: 'COMP-HIPAA-02' },
  { id: 'R-BIGDECIMAL', title: 'double money → BigDecimal', kind: 'generative', description: 'Eliminates floating-point currency errors with scaled BigDecimal arithmetic.' },
  { id: 'R-VALIDATION', title: 'Bean Validation on inputs', kind: 'generative', description: 'Untrusted inputs become validated records (jakarta.validation).' },
  { id: 'R-AUTHN', title: 'Authenticate every endpoint', kind: 'generative', description: 'Spring Security 6 stateless filter chain; no unauthenticated or backdoor admin commands.', control: 'CWE-306' },
  { id: 'R-SERVER-AUTH', title: 'Server-authoritative state', kind: 'generative', description: 'Clients can no longer assert results (e.g. scores); the server computes and signs them.', control: 'CWE-602' },
  { id: 'R-PARITY-TESTS', title: 'Synthesized parity tests', kind: 'generative', description: 'JUnit 5 tests derived from RESS business rules prove behavioural parity with the legacy system.' },
];

export const recipeById = (id: string) => RECIPES.find((r) => r.id === id);
