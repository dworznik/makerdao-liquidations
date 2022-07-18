import { rangeChunks } from 'chunks';

describe('rangeChunks', () => {
  it('splits a range into fixed-size [start, end] chunks', () => {
    expect(rangeChunks(0, 25, 10)).toEqual([
      [0, 10],
      [10, 20],
      [20, 25],
    ]);
  });

  it('clamps the final chunk to the end bound', () => {
    expect(rangeChunks(100, 130, 10)).toEqual([
      [100, 110],
      [110, 120],
      [120, 130],
    ]);
  });

  it('returns a single chunk when the chunk size exceeds the range', () => {
    expect(rangeChunks(0, 5, 100)).toEqual([[0, 5]]);
  });

  it('returns a single zero-width chunk when start === end', () => {
    expect(rangeChunks(42, 42, 10)).toEqual([[42, 42]]);
  });
});
