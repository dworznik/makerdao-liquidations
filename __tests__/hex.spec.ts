import { hexToAscii } from 'hex';

describe('hexToAscii', () => {
  it('decodes a zero-padded bytes32 ilk into its ASCII name', () => {
    // "ETH-A" (0x4554482d41) right-padded with zero bytes to 32 bytes.
    const ilk = `0x4554482d41${'00'.repeat(27)}`;
    expect(hexToAscii(ilk)).toBe('ETH-A');
  });

  it('returns an empty string for an all-zero word', () => {
    expect(hexToAscii(`0x${'00'.repeat(32)}`)).toBe('');
  });
});
