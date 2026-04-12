import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import path from 'node:path';

describe('runtime dashboard ui reviewer projection contract', () => {
  it('renders reviewer contract and route explainability in the dashboard UI source', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'packages', 'scoring', 'dashboard', 'ui', 'src', 'main.jsx'),
      'utf8'
    );

    expect(source).toContain('reviewer_contract');
    expect(source).toContain('reviewer_route_explainability');
    expect(source).toContain('Reviewer');
    expect(source).toContain('Closeout');
    expect(source).toContain('latestCloseoutLabel');
    expect(source).toContain('closeoutResultCodeLabel');
    expect(source).toContain('packetClosureLabel');
    expect(source).toContain('currentCarrier');
    expect(source).toContain('routeReason');
    expect(source).toContain('complexityLabel');
    expect(source).toContain('blockerLabel');
    expect(source).toContain('readinessBaselineLabel');
    expect(source).toContain('effectiveVerdictLabel');
    expect(source).toContain('driftSeverityLabel');
    expect(source).toContain('ReadinessProjectionCard');
    expect(source).toContain('cursor');
    expect(source).toContain('claude');
  });
});
