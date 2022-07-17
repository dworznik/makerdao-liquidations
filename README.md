# MakerDAO Liquidation Analysis

TypeScript scripts that mine MakerDAO's core contracts on Ethereum mainnet to
reconstruct **liquidations** and **Vat accounting events** into flat CSVs for
analysis.

Each script is a small, single-purpose [ethers](https://docs.ethers.org/v5/)
program: it scans a block range for one event, replays the relevant contract
state at the liquidation block, and writes a CSV to stdout. The interesting work
is in correlating a liquidation with the collateral auction it kicks off, and in
decoding MakerDAO's `LogNote` events to recover the accounting calls behind them.

## MakerDAO background

MakerDAO (the "DSS" / Multi-Collateral Dai system) lets users lock collateral in
a **vault** (`urn`) and draw the DAI stablecoin against it. Each collateral type
is an **ilk**. The [`Vat`](https://docs.makerdao.com/smart-contract-modules/core-module/vat-detailed-documentation)
is the central accounting engine; every vault is a `(ink, art)` pair — `ink` is
locked collateral, `art` is normalized debt. Actual debt is `art × rate`, where
`rate` is the per-ilk stability-fee accumulator.

### Liquidations: 1.0 vs 2.0

When a vault becomes unsafe (its collateral value falls below `art × rate ×
liquidation-ratio`), it is liquidated and its collateral auctioned for DAI.
MakerDAO has shipped two liquidation systems, and this repo analyzes both:

| | Liquidation 1.0 | Liquidation 2.0 (since Apr 2021) |
| --- | --- | --- |
| Trigger contract | [`Cat`](https://etherscan.io/address/0xa5679C04fc3d9d8b0AaB1F0ab83555b301cA70Ea) | [`Dog`](https://etherscan.io/address/0x135954d155898D42C90D2a57824C690e0c7BEf1B) |
| Trigger event | `Bite` | `Bark` |
| Auction | `Flipper` (English tend/dent auction) | `Clipper` (Dutch falling-price auction) |
| Auction start event | `Kick` | `Kick` |
| Penalty parameter | `cat.ilks[ilk].chop` | `dog.ilks[ilk].chop` |
| Script | [`src/bites.ts`](src/bites.ts) | [`src/barks.ts`](src/barks.ts) |

### Correlating the liquidation with its auction

`Bite`/`Bark` only tells you a vault was liquidated. To recover what actually
went to auction you have to join it to the `Kick` event emitted by the
`Flipper`/`Clipper` **in the same block**. The auction contract address isn't
known ahead of time (it's per-ilk, carried in the event), so the scripts query
all `Kick` logs for that block and match on `(id, lot)`. See `unsafeTypedEvent`
and the kick-matching loop in `src/barks.ts`.

### Liquidation penalty

The headline metric is the **liquidation penalty** actually charged. In
Liquidation 2.0:

- `Bark.due` is the debt being liquidated (debt + accrued stability fees), in `rad`.
- The Clipper `Kick.tab` is the DAI target the auction must raise — debt **plus**
  penalty, i.e. `due × chop`.
- So `penalty = Kick.tab − Bark.due`, which should equal `due × (chop − 1)`.

This is cross-checked against the `chop` multiplier in force at the liquidation
block: most ilks charge `chop = 1.13` (a 13% penalty), though some run at `1.0`
(no penalty). See [`docs/liquidations.md`](docs/liquidations.md).

### Vat accounting via `LogNote`

The `Vat` doesn't emit rich typed events for its internal calls; instead it logs
a generic `LogNote` whose topics are the 4-byte function selector and arguments,
and whose `data` is the raw calldata. Two of those calls are reconstructed here
by slicing off the selector and ABI-decoding the calldata:

- **`fold(ilk, urn, rate)`** — accrues stability fees by bumping the `rate`
  accumulator. [`src/folds.ts`](src/folds.ts) decodes each `fold` and computes the
  DAI minted/burned (`Art × rate-delta`).
- **`frob(ilk, urn, src, dst, dink, dart)`** — opens/modifies a vault: `dink`
  changes locked collateral, `dart` changes drawn debt.
  [`src/frobs.ts`](src/frobs.ts) decodes every vault manipulation.

## Layout

```
src/
  bites.ts       Liquidation 1.0: Cat.Bite joined to its Flipper Kick
  barks.ts       Liquidation 2.0: Dog.Bark joined to its Clipper Kick + vault state
  folds.ts       Vat.fold (stability-fee rate accrual) via LogNote
  frobs.ts       Vat.frob (vault collateral/debt changes) via LogNote
  consts.ts      Contract addresses and per-year block boundaries
  provider.ts    RPC provider factories (read from env)
  chunks.ts      Block-range chunking to stay under RPC getLogs limits
  pairs.ts       Pair up events to fan lookups across two providers (folds.ts)
  csv.ts         Stream records to stdout as CSV
  hex.ts         Decode a bytes32 ilk into its ASCII name (e.g. ETH-A)
  events/dog.ts  io-ts codecs for typed, validated event decoding
  abi/           JSON ABIs for the contracts queried
docs/            Notes on the liquidation systems and the SCD→MCD transition
__tests__/       Offline unit tests (pure helpers + io-ts codecs)
```

## Setup

Requires **Node 18+** and Yarn.

```bash
yarn install
cp .env.example .env   # then fill in your RPC endpoints
```

> **Archive node required.** These scripts read historical contract state
> (`vat.ilks` / `vat.urns` at a past `blockTag`), so `MAINNET_RPC_URL` must point
> at an **archive** node. A regular full node will fail on historical lookups.

## Running

Each analysis prints CSV to stdout; redirect it to a file:

```bash
yarn analyze:barks > output/barks-2021.csv
yarn analyze:bites > output/bites.csv
yarn analyze:folds > output/folds.csv
yarn analyze:frobs > output/frobs.csv
```

Progress is logged to stderr, so it won't pollute the CSV on stdout. The block
range each script scans is set in [`src/consts.ts`](src/consts.ts).

## CSV columns

Values are scaled out of MakerDAO's fixed-point units — `wad` (1e18), `ray`
(1e27), `rad` (1e45) — into decimal strings.

`barks.ts` (Liquidation 2.0):

| Column | Meaning |
| --- | --- |
| `tx`, `block`, `timestamp` | Liquidation transaction / block |
| `bark.urn`, `bark.ilk` | Vault address and collateral type |
| `bark.ink`, `bark.art` | Collateral seized / debt liquidated (vault units) |
| `bark.due` | Debt + stability fees being covered (DAI) |
| `kick.id`, `kick.lot`, `kick.tab` | Clipper auction id, collateral lot, DAI target (debt + penalty) |
| `dog.chop` | Liquidation penalty multiplier at the block |
| `vat.rate`, `vat.spot` | Stability-fee accumulator and price-with-safety-margin |
| `urn0.ink/art`, `urn.ink/art` | Vault state in the block before vs at the bark |

`bites.ts` (Liquidation 1.0) emits the analogous `bite.*` / `kick.*` / `cat.*` /
`vat.*` columns; `folds.ts` and `frobs.ts` emit the decoded `fold`/`frob`
arguments plus the relevant ilk state.

## Testing

```bash
yarn typecheck   # ttsc --noEmit
yarn lint
yarn test        # offline: pure helpers + io-ts codecs, no network
```

The analysis scripts themselves are not exercised in CI — they require an
archive node. CI runs typecheck, lint, unit tests, and the build.

## Notes & limitations

- Generated CSVs (`output/`) are not committed.
- Default block ranges cover 2021–2022 (see `consts.ts`); adjust for other periods.
- Event args are mapped onto typed shapes with a small, deliberately-named
  `unsafeTypedEvent` helper in the scripts; `src/events/dog.ts` shows the fully
  validated [io-ts](https://github.com/gcanti/io-ts) codec alternative.
