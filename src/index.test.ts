import { describe, expect, test } from 'bun:test';
import { program } from './index.ts';

describe('CLI Program', () => {
  test('should have generate command', () => {
    const generateCommand = program.find('generate');
    expect(generateCommand).toBeDefined();
  });
});
