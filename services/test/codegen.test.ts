import { describe, expect, it } from 'vitest';
import { SAMPLES, GOLDEN } from '../src/generated/bundle';
import { sanitizeProject } from '../src/lib/codegen';
import { parseTests } from '../src/handlers/pipeline';
import { zipFiles } from '../src/lib/zip';

describe('codegen', () => {
  const sample = SAMPLES['cyberrunner-1998'];
  it('drops traversal / unexpected paths and injects the platform pom', () => {
    const out = sanitizeProject(sample, [
      { path: '../../etc/passwd', content: 'x' },
      { path: 'pom.xml', content: '<evil/>' },
      { path: 'buildspec.yml', content: 'x' },
      { path: 'src/main/java/com/cyberrunner/A.java', content: 'class A {}' },
    ]);
    expect(out.map((f) => f.path)).toEqual(['pom.xml', 'src/main/java/com/cyberrunner/A.java', 'src/main/resources/application.properties']);
    expect(out[0].content).toContain('<artifactId>cyberrunner-2026</artifactId>');
    expect(out[0].content).toContain('<version>3.3.4</version>');
  });

  it('golden runs survive sanitization unchanged', () => {
    for (const id of Object.keys(GOLDEN)) {
      const files = GOLDEN[id].files;
      const out = sanitizeProject(SAMPLES[id], files);
      expect(out.length).toBe(files.length);
    }
  });

  it('zip is deterministic', () => {
    const files = GOLDEN['cyberrunner-1998'].files;
    expect(zipFiles(files).sha256).toBe(zipFiles([...files].reverse()).sha256);
  });

  it('parses surefire summaries', () => {
    const r = parseTests([
      '[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.017 s -- in com.cyberrunner.engine.GameEngineParityTest',
      '[ERROR] Tests run: 3, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 0.5 s <<< FAILURE! -- in com.cyberrunner.score.ScoreServiceTest',
      '[ERROR] /codebuild/src/main/java/A.java:[3,1] cannot find symbol',
    ]);
    expect(r.total).toEqual({ run: 10, failures: 1, errors: 0, skipped: 0 });
    expect(r.compilerErrors).toHaveLength(1);
  });
});
