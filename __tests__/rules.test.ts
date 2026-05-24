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

  it('flags lockfiles', () => {
    expect(classifyPath('pnpm-lock.yaml').category).toBe('lockfile');
  });

  it('flags agent instruction files', () => {
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
