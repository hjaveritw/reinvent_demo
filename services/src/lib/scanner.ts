import { CVE_DB } from './cve-db';
import type { DependencyInfo, Finding, ScanReport, Severity, SourceFile } from './types';

interface LineRule {
  ruleId: string;
  category: Finding['category'];
  severity: Severity;
  pattern: RegExp;
  message: string;
  recipe?: string;
  control?: string;
}

const LINE_RULES: LineRule[] = [
  { ruleId: 'JAVA-THREAD-SLEEP', category: 'concurrency', severity: 'medium', pattern: /Thread\.sleep\s*\(/, message: 'Thread.sleep-driven loop blocks a platform thread', recipe: 'R-VTHREADS' },
  { ruleId: 'JAVA-SYNCHRONIZED', category: 'concurrency', severity: 'low', pattern: /\bsynchronized\b/, message: 'Monitor lock (pins virtual threads, global contention)', recipe: 'R-LOCKS' },
  { ruleId: 'JAVA-RAW-SOCKET', category: 'deprecated-api', severity: 'high', pattern: /new\s+ServerSocket\s*\(|\.accept\s*\(\s*\)/, message: 'Unauthenticated raw TCP socket server', recipe: 'R-STOMP', control: 'CWE-306' },
  { ruleId: 'JAVA-LEGACY-COLLECTION', category: 'deprecated-api', severity: 'low', pattern: /\b(Vector|Hashtable|StringBuffer)\b/, message: 'Legacy synchronized collection type', recipe: 'R-COLLECTIONS' },
  { ruleId: 'JAVA-JAVAX', category: 'deprecated-api', severity: 'medium', pattern: /import\s+javax\.(servlet|persistence|validation)\./, message: 'javax.* namespace removed in Jakarta EE 9+', recipe: 'R-JAKARTA' },
  { ruleId: 'JAVA-LOG4J1', category: 'deprecated-api', severity: 'high', pattern: /import\s+org\.apache\.log4j\./, message: 'Log4j 1.x is end-of-life', recipe: 'R-SLF4J-MASK' },
  { ruleId: 'JAVA-WEAK-HASH', category: 'crypto', severity: 'high', pattern: /MessageDigest\.getInstance\(\s*"(MD5|SHA-1|SHA1)"/, message: 'Weak hash algorithm (not FIPS 140-3 approved)', recipe: 'R-SHA256', control: 'COMP-FEDRAMP-01' },
  { ruleId: 'JAVA-SQL-CONCAT', category: 'injection', severity: 'critical', pattern: /execute(Query|Update)?\s*\(\s*"[^"]*"\s*\+/, message: 'SQL built by string concatenation (CWE-89)', recipe: 'R-JPA', control: 'CWE-89' },
  { ruleId: 'JAVA-DRIVERMANAGER', category: 'deprecated-api', severity: 'low', pattern: /DriverManager\.getConnection/, message: 'Unpooled DriverManager connections', recipe: 'R-JPA' },
  { ruleId: 'JAVA-LOG-CONCAT', category: 'logging', severity: 'medium', pattern: /\blog\.(info|debug|warn|error|trace)\s*\(\s*"[^"]*"\s*\+/, message: 'String-concatenated log statement', recipe: 'R-SLF4J-MASK', control: 'COMP-GDPR-02' },
  { ruleId: 'JAVA-LOG-PII', category: 'pii', severity: 'high', pattern: /\blog\.\w+\s*\(.*(getRemoteAddr|getInetAddress|card|ssn|password|User-Agent|@)/i, message: 'PII / credentials / IP written to logs', recipe: 'R-SLF4J-MASK', control: 'COMP-GDPR-02' },
  { ruleId: 'JAVA-DOUBLE-MONEY', category: 'deprecated-api', severity: 'medium', pattern: /\bdouble\s+(amount|balance|fee|transferredToday)\b|double\s+[A-Z_]*(LIMIT|THRESHOLD)\b/, message: 'Currency held in binary floating point', recipe: 'R-BIGDECIMAL' },
  { ruleId: 'JAVA-SERVLET', category: 'deprecated-api', severity: 'low', pattern: /extends\s+HttpServlet/, message: 'Hand-written servlet without input validation', recipe: 'R-VALIDATION' },
];

const SECRET_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /(password|passwd|pwd|secret)\s*=\s*"([^"]{4,})"/i, message: 'Hardcoded credential literal' },
  { pattern: /[?&;](password|pwd)=([^&;"\s]{4,})/i, message: 'Credential embedded in connection URL' },
  { pattern: /\b[A-Z_]*PASSWORD\s*=\s*"([^"]{4,})"/, message: 'Hardcoded password constant' },
];

const SSN = /\b\d{3}-\d{2}-\d{4}\b/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const DIGITS = /\b\d{13,19}\b/g;

export function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Masks secrets / PANs / SSNs in snippets so the scan report itself never leaks sensitive data. */
export function redact(line: string): string {
  let out = line.trim();
  for (const { pattern } of SECRET_PATTERNS) {
    out = out.replace(new RegExp(pattern.source, pattern.flags + 'g'), (m) => {
      const val = m.match(/[=]\s*"?([^"&;\s]+)/)?.[1] ?? '';
      return val ? m.replace(val, val.slice(0, 2) + '*'.repeat(Math.max(4, val.length - 2))) : m;
    });
  }
  out = out.replace(DIGITS, (d) => (luhn(d) ? d.slice(0, 6) + '******' + d.slice(-4) : d));
  out = out.replace(new RegExp(SSN.source, 'g'), (s) => '***-**-' + s.slice(-4));
  return out.length > 160 ? out.slice(0, 157) + '...' : out;
}

export function parsePomDependencies(pom: string): { group: string; artifact: string; version: string }[] {
  const deps: { group: string; artifact: string; version: string }[] = [];
  const re = /<dependency>([\s\S]*?)<\/dependency>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pom))) {
    const body = m[1];
    const g = body.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim();
    const a = body.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim();
    const v = body.match(/<version>([^<]+)<\/version>/)?.[1]?.trim() ?? 'managed';
    if (g && a) deps.push({ group: g, artifact: a, version: v });
  }
  return deps;
}

function extOf(path: string) {
  const i = path.lastIndexOf('.');
  return i < 0 ? 'other' : path.slice(i + 1);
}

/** Deterministic pre-scan ("AI Works Ingest"): LOC, dependency CVEs, deprecated APIs, secrets, PII and PAN. */
export function scan(files: SourceFile[]): ScanReport {
  const started = Date.now();
  const findings: Finding[] = [];
  const languages: Record<string, number> = {};
  let totalLoc = 0;
  let seq = 0;
  const add = (f: Omit<Finding, 'id'>) => findings.push({ id: `F-${String(++seq).padStart(3, '0')}`, ...f });

  const dependencies: DependencyInfo[] = [];
  const pomJavaLevel: string[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    const loc = lines.filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('*')).length;
    totalLoc += loc;
    const ext = extOf(file.path);
    languages[ext] = (languages[ext] ?? 0) + loc;

    if (file.path.endsWith('pom.xml')) {
      for (const d of parsePomDependencies(file.content)) {
        const key = `${d.group}:${d.artifact}`;
        const entry = CVE_DB[key];
        const info: DependencyInfo = {
          coordinate: key,
          version: d.version,
          status: entry?.status ?? 'ok',
          cves: entry?.cves ?? [],
          replacement: entry?.replacement ?? 'Managed by Spring Boot 3.3.4 BOM',
        };
        dependencies.push(info);
        const line = lines.findIndex((l) => l.includes(`<artifactId>${d.artifact}</artifactId>`)) + 1;
        for (const cve of info.cves) {
          add({ ruleId: 'DEP-CVE', category: 'dependency', severity: cve.severity, file: file.path, line, snippet: `${key}:${d.version}`, message: cve.summary, cve: cve.id, recipe: 'R-BOOT3' });
        }
        if (info.status === 'eol' || info.status === 'deprecated') {
          add({ ruleId: 'DEP-EOL', category: 'dependency', severity: 'medium', file: file.path, line, snippet: `${key}:${d.version}`, message: `${info.status.toUpperCase()} dependency → ${info.replacement}`, recipe: 'R-BOOT3' });
        }
      }
      const src = file.content.match(/<maven\.compiler\.source>([^<]+)</)?.[1];
      if (src) pomJavaLevel.push(src);
      continue;
    }

    lines.forEach((text, idx) => {
      const line = idx + 1;
      for (const rule of LINE_RULES) {
        if (rule.pattern.test(text)) {
          add({ ruleId: rule.ruleId, category: rule.category, severity: rule.severity, file: file.path, line, snippet: redact(text), message: rule.message, recipe: rule.recipe, control: rule.control });
        }
      }
      for (const s of SECRET_PATTERNS) {
        if (s.pattern.test(text)) {
          add({ ruleId: 'SECRET-LITERAL', category: 'secret', severity: 'critical', file: file.path, line, snippet: redact(text), message: s.message, recipe: 'R-SECRETS', control: 'COMP-GDPR-01' });
          break;
        }
      }
      for (const d of text.match(DIGITS) ?? []) {
        if (luhn(d)) {
          add({ ruleId: 'PAN-LITERAL', category: 'pan', severity: 'high', file: file.path, line, snippet: redact(text), message: 'Luhn-valid PAN literal in source', recipe: 'R-PAN-TOKEN', control: 'COMP-PCI-01' });
        }
      }
      if (SSN.test(text)) {
        add({ ruleId: 'PII-SSN', category: 'pii', severity: 'high', file: file.path, line, snippet: redact(text), message: 'SSN pattern in source', recipe: 'R-FIELD-ENCRYPT', control: 'COMP-GDPR-01' });
      }
      if (EMAIL.test(text) && !text.trim().startsWith('import')) {
        add({ ruleId: 'PII-EMAIL', category: 'pii', severity: 'medium', file: file.path, line, snippet: redact(text), message: 'Email address / pattern in source', recipe: 'R-SLF4J-MASK', control: 'COMP-GDPR-01' });
      }
      if (/(cardNumber|card_number)\b/.test(text) && /(String|getString|setCardNumber)/.test(text)) {
        add({ ruleId: 'PAN-FIELD', category: 'pan', severity: 'high', file: file.path, line, snippet: redact(text), message: 'Cleartext PAN field handled/stored', recipe: 'R-PAN-TOKEN', control: 'COMP-PCI-01' });
      }
    });
  }

  if (pomJavaLevel.some((v) => v === '1.8' || v === '8')) {
    add({ ruleId: 'JAVA-EOL-LEVEL', category: 'deprecated-api', severity: 'medium', file: 'pom.xml', line: 0, snippet: 'maven.compiler.source=1.8', message: 'Java 8 target — migrate to Java 21 LTS', recipe: 'R-BOOT3' });
  }

  const summary = {
    'deprecated-api': 0, concurrency: 0, secret: 0, pii: 0, pan: 0, crypto: 0, injection: 0, dependency: 0, logging: 0, auth: 0,
  } as ScanReport['summary'];
  for (const f of findings) summary[f.category]++;

  return { totalFiles: files.length, totalLoc, languages, dependencies, findings, summary, durationMs: Date.now() - started };
}
