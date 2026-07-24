import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const readProjectFile = (path: string) => readFileSync(path, 'utf8');

function exactLocationBlock(config: string, path: string) {
  const marker = `location = ${path} {`;
  const start = config.indexOf(marker);
  const end = config.indexOf('\n}', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return config.slice(start, end + 2);
}

describe('production API routing', () => {
  test('routes deployed report paths to port 3001 before the task fallback', () => {
    const config = readProjectFile('deploy/nginx.data1.locations.conf');
    const shellRoot = 'location = /testwise/ {';
    const shellIndex = 'location = /testwise/index.html {';
    const exactReport = 'location = /testwise/api/reports {';
    const nestedReports = 'location ^~ /testwise/api/reports/ {';
    const catalogEvents = 'location = /testwise/api/catalog/events {';
    const qualityEvents = 'location = /testwise/api/quality/overview/events {';
    const remainingApi = 'location ^~ /testwise/api/ {';
    const staticFallback = 'location ^~ /testwise/ {';
    const qualityEventsBlock = exactLocationBlock(
      config,
      '/testwise/api/quality/overview/events'
    );

    expect(config).toContain(shellRoot);
    expect(config).toContain(shellIndex);
    expect(config.match(/add_header Cache-Control "no-cache, no-store, must-revalidate" always;/g))
      .toHaveLength(2);
    expect(config).toContain(exactReport);
    expect(config).toContain(nestedReports);
    expect(config).toContain('proxy_pass http://127.0.0.1:3001/api/reports;');
    expect(config).toContain('proxy_pass http://127.0.0.1:3001/api/reports/;');
    expect(config).toContain(catalogEvents);
    expect(config).toContain('proxy_pass http://127.0.0.1:3000/api/catalog/events;');
    expect(config).toContain(qualityEvents);
    expect(config).toContain(
      'proxy_pass http://127.0.0.1:3000/api/quality/overview/events;'
    );
    expect(qualityEventsBlock).toContain('proxy_set_header Connection "";');
    expect(qualityEventsBlock).toContain('proxy_buffering off;');
    expect(qualityEventsBlock).toContain('proxy_cache off;');
    expect(qualityEventsBlock).toContain('proxy_read_timeout 1h;');
    expect(qualityEventsBlock).toContain('add_header X-Accel-Buffering "no";');
    expect(config).toContain('proxy_pass http://127.0.0.1:3000/api/;');
    expect(config.indexOf(exactReport)).toBeLessThan(config.indexOf(remainingApi));
    expect(config.indexOf(nestedReports)).toBeLessThan(config.indexOf(remainingApi));
    expect(config.indexOf(catalogEvents)).toBeLessThan(config.indexOf(remainingApi));
    expect(config.indexOf(qualityEvents)).toBeLessThan(config.indexOf(remainingApi));
    expect(config.indexOf(shellRoot)).toBeLessThan(config.indexOf(staticFallback));
    expect(config.indexOf(shellIndex)).toBeLessThan(config.indexOf(staticFallback));
  });

  test('keeps task and report upstreams independently configurable in the container', () => {
    const nginx = readProjectFile('deploy/nginx.conf');
    const dockerfile = readProjectFile('Dockerfile');
    const compose = readProjectFile('deploy/docker-compose.yml');
    const exactReport = 'location = /api/reports {';
    const nestedReports = 'location ^~ /api/reports/ {';
    const catalogEvents = 'location = /api/catalog/events {';
    const qualityEvents = 'location = /api/quality/overview/events {';
    const remainingApi = 'location /api/ {';
    const shellIndex = 'location = /index.html {';
    const qualityEventsBlock = exactLocationBlock(
      nginx,
      '/api/quality/overview/events'
    );

    expect(nginx).toContain(shellIndex);
    expect(nginx).toContain(
      'add_header Cache-Control "no-cache, no-store, must-revalidate" always;'
    );
    expect(nginx).toContain('set $report_backend_upstream ${REPORT_BACKEND_UPSTREAM};');
    expect(nginx).toContain(exactReport);
    expect(nginx).toContain(nestedReports);
    expect(nginx).toContain(catalogEvents);
    expect(nginx).toContain(qualityEvents);
    expect(nginx.match(/proxy_pass http:\/\/\$report_backend_upstream;/g)).toHaveLength(2);
    expect(nginx.match(/proxy_pass http:\/\/\$backend_upstream;/g)).toHaveLength(3);
    expect(qualityEventsBlock).toContain('proxy_set_header Connection "";');
    expect(qualityEventsBlock).toContain('proxy_buffering off;');
    expect(qualityEventsBlock).toContain('proxy_cache off;');
    expect(qualityEventsBlock).toContain('proxy_read_timeout 1h;');
    expect(qualityEventsBlock).toContain('add_header X-Accel-Buffering "no";');
    expect(nginx).not.toContain('proxy_pass http://$report_backend_upstream/api/reports');
    expect(nginx).not.toContain('proxy_pass http://$backend_upstream/api/');
    expect(nginx.indexOf(exactReport)).toBeLessThan(nginx.indexOf(remainingApi));
    expect(nginx.indexOf(nestedReports)).toBeLessThan(nginx.indexOf(remainingApi));
    expect(nginx.indexOf(catalogEvents)).toBeLessThan(nginx.indexOf(remainingApi));
    expect(nginx.indexOf(qualityEvents)).toBeLessThan(nginx.indexOf(remainingApi));

    expect(dockerfile).toContain('ENV REPORT_BACKEND_UPSTREAM=backend:3001');
    expect(compose).toContain(
      'REPORT_BACKEND_UPSTREAM: ${REPORT_BACKEND_UPSTREAM:-backend:3001}'
    );
  });
});
