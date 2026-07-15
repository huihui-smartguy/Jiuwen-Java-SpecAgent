import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readProjectFile = (path: string) => readFileSync(path, 'utf8');

describe('production API routing', () => {
  test('routes deployed report paths to port 3001 before the task fallback', () => {
    const config = readProjectFile('deploy/nginx.data1.locations.conf');
    const exactReport = 'location = /testwise/api/reports {';
    const nestedReports = 'location ^~ /testwise/api/reports/ {';
    const remainingApi = 'location ^~ /testwise/api/ {';

    expect(config).toContain(exactReport);
    expect(config).toContain(nestedReports);
    expect(config).toContain('proxy_pass http://127.0.0.1:3001/api/reports;');
    expect(config).toContain('proxy_pass http://127.0.0.1:3001/api/reports/;');
    expect(config).toContain('proxy_pass http://127.0.0.1:3000/api/;');
    expect(config.indexOf(exactReport)).toBeLessThan(config.indexOf(remainingApi));
    expect(config.indexOf(nestedReports)).toBeLessThan(config.indexOf(remainingApi));
  });

  test('keeps task and report upstreams independently configurable in the container', () => {
    const nginx = readProjectFile('deploy/nginx.conf');
    const dockerfile = readProjectFile('Dockerfile');
    const compose = readProjectFile('deploy/docker-compose.yml');
    const exactReport = 'location = /api/reports {';
    const nestedReports = 'location ^~ /api/reports/ {';
    const remainingApi = 'location /api/ {';

    expect(nginx).toContain('set $report_backend_upstream ${REPORT_BACKEND_UPSTREAM};');
    expect(nginx).toContain(exactReport);
    expect(nginx).toContain(nestedReports);
    expect(nginx).toContain('proxy_pass http://$report_backend_upstream/api/reports;');
    expect(nginx).toContain('proxy_pass http://$report_backend_upstream/api/reports/;');
    expect(nginx.indexOf(exactReport)).toBeLessThan(nginx.indexOf(remainingApi));
    expect(nginx.indexOf(nestedReports)).toBeLessThan(nginx.indexOf(remainingApi));

    expect(dockerfile).toContain('ENV REPORT_BACKEND_UPSTREAM=backend:3001');
    expect(compose).toContain(
      'REPORT_BACKEND_UPSTREAM: ${REPORT_BACKEND_UPSTREAM:-backend:3001}'
    );
  });
});
