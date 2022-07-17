import { isBigNumberish } from '@ethersproject/bignumber/lib/bignumber';
import { BigNumberish } from 'ethers';
import * as t from 'io-ts';

const isHex = (s: string) => /^[A-Fa-f0-9]+$/i.test(s);

/**
 * io-ts codec for anything ethers accepts as a BigNumber — a bigint, a
 * BigNumber instance, a decimal/hex string, etc. Validation delegates to
 * ethers' own `isBigNumberish` so the codec stays in lockstep with the library.
 */
export const BigNumberLike = new t.Type<BigNumberish, BigNumberish, unknown>(
  'BigNumberLike',
  (u: unknown): u is BigNumberish => isBigNumberish(u),
  (u, c) => (isBigNumberish(u) ? t.success(u) : t.failure(u, c)),
  t.identity
);

export type BigNumberLike = t.TypeOf<typeof BigNumberLike>;

/** Ergonomic alias for decoding a single BigNumber-ish value. */
export const bigNumberish = BigNumberLike;

interface AddressBrand {
  readonly Address: unique symbol;
}

/**
 * A branded 20-byte Ethereum address (`0x` followed by 40 hex chars). Branding
 * makes "this string has been validated as an address" part of the type, so a
 * raw string can't be passed where an `Address` is expected.
 */
export const Address = t.brand(
  t.string,
  (s: string): s is t.Branded<string, AddressBrand> =>
    s.length === 42 && s.startsWith('0x') && isHex(s.substring(2)),
  'Address'
);

export type Address = t.TypeOf<typeof Address>;

/**
 * `Dog.Bark(ilk, urn, ink, art, due, clip, id)` — the Liquidation 2.0 event
 * that flags an unsafe vault and kicks off a Clipper auction.
 *
 * `urn`/`clip` are decoded as plain strings rather than `Address` so the codec
 * accepts log payloads as-is; tighten to `Address` where validation is wanted.
 */
export const Bark = t.type({
  urn: t.string,
  ink: BigNumberLike,
  art: BigNumberLike,
  due: BigNumberLike,
  clip: t.string,
  id: BigNumberLike,
});

export type Bark = t.TypeOf<typeof Bark>;
