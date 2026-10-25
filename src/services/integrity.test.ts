import { describe, test, expect } from 'vitest';
import { canonicalize, hashData } from './integrity';

describe('canonicalize', () => {
  test('Equivalent key order produces identical canonical output', () => {
    const a = { a: 1, b: 2 };
    const b = { b: 2, a: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  test('Nested key order produces identical output', () => {
    const a = { outer: { a: 1, b: 2 }, c: 3 };
    const b = { c: 3, outer: { b: 2, a: 1 } };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  test('Nested value change changes canonical output', () => {
    const a = { newState: { title: "A" } };
    const b = { newState: { title: "B" } };
    expect(canonicalize(a)).not.toBe(canonicalize(b));
  });

  test('Deep nested modification changes hash', async () => {
    const a = { reviews: [{ comment: "Looks good", id: 1 }] };
    const b = { reviews: [{ comment: "Looks bad", id: 1 }] };
    expect(canonicalize(a)).not.toBe(canonicalize(b));
    const hashA = await hashData(a);
    const hashB = await hashData(b);
    expect(hashA).not.toBe(hashB);
  });

  test('Array order remains meaningful', () => {
    const a = ["A", "B"];
    const b = ["B", "A"];
    expect(canonicalize(a)).not.toBe(canonicalize(b));
  });

  test('Empty structures remain distinguishable', () => {
    const obj = {};
    const arr: any[] = [];
    expect(canonicalize(obj)).not.toBe(canonicalize(arr));
  });
  
  test('Ignores undefined values', () => {
    const a = { a: 1, b: undefined };
    const b = { a: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });
});
