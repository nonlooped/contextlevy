import { classifyPath } from '../src/rules';

describe('classifyPath', () => {
  it('flags prisma generated output', () => {
    const match = classifyPath('prisma/generated/client/index.js');
    expect(match.category).toBe('generated');
  });

  it('flags coverage output', () => {
    const match = classifyPath('coverage/lcov.info');
    expect(match.category).toBe('coverage');
    expect(match.suggestion).toMatch(/\.gitignore/i);
  });

  it('flags vendor and third_party directories', () => {
    expect(classifyPath('vendor/github.com/foo/bar.go').category).toBe('vendor');
    expect(classifyPath('third_party/dep/lib.cpp').category).toBe('vendor');
  });

  it('flags source maps and wasm', () => {
    expect(classifyPath('dist/app.js.map').category).toBe('source-map');
    expect(classifyPath('pkg/main.wasm').category).toBe('binary-asset');
  });

  it('flags protobuf and grpc generated files', () => {
    expect(classifyPath('api/user.pb.go').category).toBe('protobuf');
    expect(classifyPath('proto/user_pb2.py').category).toBe('protobuf');
  });

  it('flags openapi and swagger dumps', () => {
    expect(classifyPath('openapi/generated/client.ts').category).toBe('openapi');
    expect(classifyPath('docs/swagger.json').category).toBe('openapi');
  });

  it('flags dependency and cache directories', () => {
    expect(classifyPath('node_modules/lodash/index.js').category).toBe('dependency-dir');
    expect(classifyPath('.turbo/cache/output.json').category).toBe('cache-dir');
  });

  it('flags test output directories', () => {
    expect(classifyPath('playwright-report/index.html').category).toBe('test-output');
    expect(classifyPath('test-results/output.xml').category).toBe('test-output');
  });

  it('flags large fixture extensions', () => {
    expect(classifyPath('fixtures/huge-response.json').category).toBe('fixture');
    expect(classifyPath('fixtures/sample.csv').category).toBe('fixture');
  });

  it('flags binary assets', () => {
    expect(classifyPath('assets/logo.png').category).toBe('binary-asset');
    expect(classifyPath('dist/bundle.zip').category).toBe('binary-asset');
  });

  it('flags lockfiles', () => {
    expect(classifyPath('pnpm-lock.yaml').category).toBe('lockfile');
  });

  it('flags agent instruction files', () => {
    expect(classifyPath('.agents/skills/foo/SKILL.md').category).toBe('agent-config');
    expect(classifyPath('.cursor/rules/react.mdc').category).toBe('agent-config');
    expect(classifyPath('AGENTS.md').category).toBe('agent-config');
  });

  it('returns other for normal source files', () => {
    expect(classifyPath('src/components/Button.tsx').category).toBe('other');
  });

  it('flags large additions via caller-provided threshold separately in analyze', () => {
    expect(classifyPath('src/big.ts').category).toBe('other');
  });
});
