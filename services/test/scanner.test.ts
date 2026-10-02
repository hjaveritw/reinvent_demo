import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../src/generated/bundle';
import { luhn, redact, scan } from '../src/lib/scanner';

describe('scanner', () => {
  it('finds dependency CVEs, secrets and concurrency issues in CyberRunner 1998', () => {
    const r = scan(SAMPLES['cyberrunner-1998'].files);
    const cves = new Set(r.findings.map((f) => f.cve).filter(Boolean));
    expect(cves).toEqual(new Set(['CVE-2019-17571', 'CVE-2021-4104', 'CVE-2015-6420', 'CVE-2017-3523']));
    expect(r.findings.some((f) => f.ruleId === 'JAVA-THREAD-SLEEP')).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'JAVA-WEAK-HASH')).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'JAVA-SQL-CONCAT')).toBe(true);
    expect(r.summary.secret).toBeGreaterThanOrEqual(2);
    expect(r.totalLoc).toBeGreaterThan(150);
  });

  it('finds Log4Shell, PAN, SSN and PII logging in the banking monolith', () => {
    const r = scan(SAMPLES['banking-monolith'].files);
    const cves = new Set(r.findings.map((f) => f.cve).filter(Boolean));
    expect(cves.has('CVE-2021-44228')).toBe(true);
    expect(cves.has('CVE-2022-22965')).toBe(true);
    expect(r.summary.pan).toBeGreaterThan(0);
    expect(r.findings.some((f) => f.ruleId === 'PII-SSN')).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'JAVA-LOG-PII')).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'JAVA-JAVAX')).toBe(true);
  });

  it('never leaks secrets, PANs or SSNs in snippets', () => {
    for (const s of Object.values(SAMPLES)) {
      const all = JSON.stringify(scan(s.files).findings);
      expect(all).not.toContain('Sup3rS3cret');
      expect(all).not.toContain('Winter2006!');
      expect(all).not.toContain('arcade1998!');
      expect(all).not.toContain('4111111111111111');
      expect(all).not.toContain('078-05-1120');
    }
  });

  it('luhn and redaction', () => {
    expect(luhn('4111111111111111')).toBe(true);
    expect(luhn('4111111111111112')).toBe(false);
    expect(redact('String pw = "hunter22";')).not.toContain('hunter22');
  });
});
