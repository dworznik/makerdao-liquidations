/**
 * Decode a MakerDAO `ilk` (collateral type) from its on-chain `bytes32`
 * representation into a human-readable string.
 *
 * Ilks are stored as `bytes32` holding the ASCII name right-padded with zero
 * bytes — e.g. `ETH-A` is `0x4554482d41000...0`. This strips the `0x` prefix,
 * drops the zero padding, and returns the ASCII name (e.g. `"ETH-A"`).
 */
export const hexToAscii = (x: string): string =>
  Buffer.from(x.substring(2), 'hex')
    .filter(b => b !== 0x00)
    .toString();
