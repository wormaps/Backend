import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const docsRoot = join(import.meta.dir, '../../docs');

describe('docs wiki index', () => {
  it('links only to existing markdown documents', () => {
    const indexPath = join(docsRoot, '00-wiki-index.md');
    const index = readFileSync(indexPath, 'utf8');
    const links = [...index.matchAll(/\]\((\.\/[^)]+\.md)\)/g)]
      .map((match) => match[1])
      .filter((link): link is string => typeof link === 'string');

    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const target = normalize(join(dirname(indexPath), link));
      expect(existsSync(target), `${link} should exist`).toBe(true);
    }
  });

  it('keeps PRD v2.3 as the product entrypoint', () => {
    const prd = readFileSync(join(docsRoot, '01-product/prd-v2.md'), 'utf8');

    expect(prd).toContain('# WorMap Digital Twin v2.3 PRD');
    expect(prd).toContain('## 7.1 Preflight Build Admission');
    expect(prd).toContain('## 8.2 SourceSnapshot Contract');
    expect(prd).toContain('### 15.1 Confidence Scoring Policy');
    expect(prd).toContain('### 21.2 Build Supersession & Retention');
    expect(prd).toContain('### Phase 0: Foundation Docs');
  });
});
