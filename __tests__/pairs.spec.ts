import { pairs } from 'pairs';

describe('pairs', () => {
  it('returns an empty array for empty input', () => {
    expect(pairs([])).toEqual([]);
  });

  it('groups an even-length array into complete pairs', () => {
    expect(pairs([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('pairs the trailing element of an odd-length array with undefined', () => {
    expect(pairs([1, 2, 3])).toEqual([
      [1, 2],
      [3, undefined],
    ]);
  });
});
