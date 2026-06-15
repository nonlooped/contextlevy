import { describe, expect, it } from 'vitest';
import {
  checkAnnotationLevelForCategory,
  isHardFailCategory,
  sarifLevelForCategory,
} from '../../src/core/categories';

describe('isHardFailCategory', () => {
  it('matches HARD_FAIL_CATEGORIES entries', () => {
    expect(isHardFailCategory('coverage')).toBe(true);
    expect(isHardFailCategory('log')).toBe(true);
    expect(isHardFailCategory('minified')).toBe(true);
  });

  it('excludes warn-only and neutral categories', () => {
    expect(isHardFailCategory('lockfile')).toBe(false);
    expect(isHardFailCategory('other')).toBe(false);
    expect(isHardFailCategory('large-file')).toBe(false);
  });
});

describe('category severity helpers', () => {
  it('maps hard-fail categories to error/failure levels', () => {
    expect(sarifLevelForCategory('coverage')).toBe('error');
    expect(checkAnnotationLevelForCategory('coverage')).toBe('failure');
  });

  it('maps other to note/notice and remaining categories to warning', () => {
    expect(sarifLevelForCategory('other')).toBe('note');
    expect(checkAnnotationLevelForCategory('other')).toBe('notice');
    expect(sarifLevelForCategory('lockfile')).toBe('warning');
    expect(checkAnnotationLevelForCategory('lockfile')).toBe('warning');
  });
});
