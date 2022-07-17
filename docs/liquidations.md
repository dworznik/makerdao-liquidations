# MakerDAO liquidation analysis

The analysis was performed on event data retrieved from the blockchain:

- **2021**: blocks 11565020 (Jan-01-2021 12:00:01 AM +UTC) – 13916165 (Dec-31-2021 11:59:49 PM +UTC)
- **2022**: blocks 13916166 (Jan-01-2022 12:00:03 AM +UTC) – 16308189 (Dec-31-2022 11:59:59 PM +UTC)

MakerDAO has run two on-chain liquidation systems. Both are covered here.

## Liquidation 2.0

Launched in April 2021, Liquidation 2.0 replaced English collateral auctions
with **Clipper** Dutch auctions (a continuously falling price, takeable at any
point), removing the need for auction keepers to lock up DAI up front.

Liquidation data is extracted from `Bark` events emitted by the
[`Dog` contract](https://etherscan.io/address/0x135954d155898D42C90D2a57824C690e0c7BEf1B)
and the `Kick` events (collateral-auction start) emitted by the associated
[`Clipper` contract](https://docs.makerdao.com/smart-contract-modules/dog-and-clipper-detailed-documentation#the-vault-liquidation-function-dog.bark-takes-three-caller-supplied-arguments).
A `Bark` and its `Kick` are joined within the same block on `(id, lot)`.

The incurred penalty is the difference between the
[`Bark.due` value](https://github.com/makerdao/dss/blob/fa4f6630afb0624d04a003e920b0d71a00331d98/src/dog.sol#L236)
(debt plus accrued stability fees) and the
[`Kick.tab` value](https://github.com/makerdao/dss/blob/fa4f6630afb0624d04a003e920b0d71a00331d98/src/clip.sol#L265)
(debt plus the penalty to be recovered in the auction):

```
penalty = Kick.tab - Bark.due   ≈   Bark.due × (chop - 1)
```

The calculated penalty is sanity-checked against the `dog.ilks[ilk].chop`
multiplier at the time of the liquidation. Most of the time the penalty is 13%
(`chop = 1.13`), but some ilks ran with no penalty (`chop = 1.0`).

Captured by [`src/barks.ts`](../src/barks.ts).

## Liquidation 1.0

The original MCD liquidation system (live from the Multi-Collateral Dai launch in
November 2019). An unsafe vault is seized by `Cat.bite`, which emits a `Bite`
event and starts an English **Flipper** auction (`tend` phase bidding DAI up to
the `tab`, then `dent` phase bidding the collateral lot down). The auction start
is the Flipper's `Kick` event.

Liquidation data is extracted from `Bite` events emitted by the
[`Cat` contract](https://etherscan.io/address/0xa5679C04fc3d9d8b0AaB1F0ab83555b301cA70Ea)
joined to the `Flipper.Kick` for the same block on `(id, lot)`.

Unlike Liquidation 2.0, the `Bite.tab` already embeds the penalty: it is the DAI
the Flip auction must raise, computed as `art × rate × chop`
(`cat.ilks[ilk].chop`). The penalty can therefore be recovered as:

```
penalty = Bite.tab - (art × rate)   ≈   debt × (chop - 1)
```

with `art`, `rate` read from `vat.ilks` / `vat.urns` at the liquidation block.

Captured by [`src/bites.ts`](../src/bites.ts).

For the still-earlier single-collateral system that preceded MCD, see
[`scd-mcd.md`](scd-mcd.md).
