# SCD → MCD: liquidations across the two systems

Before Multi-Collateral Dai (MCD), MakerDAO ran **Single-Collateral Dai (SCD,
"Sai")** from 2017 to 2019. Comparing how a liquidation works in each system is a
good way to understand the lineage of today's parameters.

In both systems a **bite** liquidates a vault once its collateralization ratio
falls below the liquidation ratio (e.g. 150%) set by Maker Governance.

## SCD (Sai), 2017

- Core contract: **`SaiTub`** at
  [`0x448a5065aeBB8E423F0896E6c5D525C040f59af3`](https://etherscan.io/address/0x448a5065aeBB8E423F0896E6c5D525C040f59af3).
- Vaults are called **cups**. A cup is `(ink, art, ire)`:
  - `ink` — locked collateral, denominated in **PETH** (Pooled ETH, which wraps
    WETH, which wraps ETH).
  - `art` — normalized Sai (stablecoin) debt; actual debt is `art × chi`.
  - `ire` — normalized total debt including the MKR governance fee; the MKR-paid
    portion is `ire × rhi − art × chi`.
- `chi` is the Sai-side debt accumulator (stability fee); `rhi` is the combined
  stability + governance fee accumulator.
- `per` is the **PETH/ETH ratio**. Liquidation penalties are absorbed by the PETH
  pool, which slowly increases `per` for all holders.
- `axe` is the liquidation penalty multiplier (≈ `1.13`, i.e. 13%).
- Prices come from the oracle (`tag` for ETH/USD; MKR/USD is used to settle the
  governance fee).

On `bite(cup)`, the cup's debt is wiped and PETH worth `debt × axe` is taken from
it; the penalty slice (`debt × (axe − 1)`) stays in the pool.

## MCD, 2020

- Vaults are called **urns**, tracked in the [`Vat`](https://docs.makerdao.com/smart-contract-modules/core-module/vat-detailed-documentation).
- An urn is `(ink, art)`; actual debt is `art × rate`. There is no separate MKR
  governance-fee accumulator — stability fees accrue in DAI via `rate`.
- Collateral is held directly (no pooled wrapper like PETH).
- Liquidation is `Cat.bite` (Liquidation 1.0) or `Dog.bark` (Liquidation 2.0),
  with the penalty multiplier `chop` (the descendant of SCD's `axe`).

See [`liquidations.md`](liquidations.md) for the MCD liquidation detail this repo
extracts.

## Parameter correspondence

| SCD (Sai, 2017) | MCD (2020) | Meaning |
| --- | --- | --- |
| `cup` | `urn` | the vault being liquidated |
| `SaiTub` | `Vat` + `Cat`/`Dog` | accounting + liquidation engine |
| `ink` (PETH) | `ink` (collateral token) | locked collateral |
| `art × chi` | `art × rate` | outstanding stablecoin debt |
| `ire × rhi` | — | SCD's total debt incl. MKR governance fee |
| `chi` | `rate` | stablecoin debt accumulator (stability fee) |
| `rhi` | — | combined stability + governance fee accumulator |
| `per` | — | PETH/ETH ratio; absorbs liquidation penalties |
| `axe` | `chop` | liquidation penalty multiplier (≈ 1.13) |
| `tag` (oracle) | `spot` / `pip` | collateral price feed |
| `bite(cup)` | `Cat.bite` / `Dog.bark` | liquidation trigger |

The key economic differences: SCD pooled all collateral as PETH and split fees
between a DAI stability fee and an **MKR-denominated governance fee**, whereas MCD
holds each collateral type separately and charges stability fees entirely in DAI.
