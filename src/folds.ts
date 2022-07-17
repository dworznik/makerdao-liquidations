import { ethers, utils, Contract, Event, BigNumberish, BigNumber } from 'ethers';
import consoleStamp from 'console-stamp';

import vatAbi from './abi/vat.json';
import { rangeChunks } from './chunks';
import { BLOCK_2021, BLOCK_2022, VAT_ADDRESS } from './consts';
import { infuraWsProvider, quickNodeWsProvider } from './provider';
import { printCSV } from './csv';
import { pairs } from './pairs';
import { hexToAscii } from './hex';

consoleStamp(console);

// `fold(ilk, urn, rate)` accrues stability fees by bumping the per-ilk `rate`
// accumulator in the Vat. It is emitted as a `LogNote`, whose first 4 bytes are
// the function selector and whose ABI-encoded calldata we decode below.
const foldIf = new utils.Interface(['function fold(bytes32,address,int256)']);

export type EventLog = {
  tx: string;
  block: number;
  timestamp?: string;
};

export type VatIlk = {
  Art: BigNumberish; // wad
  rate: BigNumberish; // ray
  spot: BigNumberish; // ray
  line: BigNumberish; // rad
  dust: BigNumberish; // rad
};

export type Fold = EventLog & {
  i: string;
  u: string;
  rate: BigNumberish;
  ilk: VatIlk;
  rad: BigNumberish;
};

async function processEvent(event: Event, vat: Contract): Promise<Fold> {
  const tx = event.transactionHash;
  const block = event.blockNumber;

  // Skip the 4-byte selector + arg padding and decode the raw `fold` calldata.
  const data = utils.hexDataSlice(event.data, 64);
  const parsed = foldIf.decodeFunctionData('fold', data);

  const i = hexToAscii(parsed[0]);
  const u = parsed[1];
  const rate = utils.formatUnits(parsed[2], 27);

  // Read the ilk state just before the fold to recover the debt base it scaled.
  const ilk = await vat.ilks(parsed[0], { blockTag: block - 1 });

  // Total DAI minted/burned by this rate change: Art (total debt) * rate delta.
  const rad = BigNumber.from(ilk.Art).mul(BigNumber.from(parsed[2]));

  return {
    tx,
    block,
    i,
    u,
    rate,
    ilk: {
      Art: utils.formatUnits(ilk.Art),
      rate: utils.formatUnits(ilk.rate, 27),
      spot: utils.formatUnits(ilk.spot, 27),
      line: utils.formatUnits(ilk.line, 45),
      dust: utils.formatUnits(ilk.dust, 45),
    },
    rad: utils.formatUnits(rad, 45),
  };
}

async function main() {
  // Two endpoints let us fan out the per-event archive `ilks` lookups.
  const provider = quickNodeWsProvider();
  const infura = infuraWsProvider();
  const vat = new ethers.Contract(VAT_ADDRESS, vatAbi, provider);
  const vat1 = new ethers.Contract(VAT_ADDRESS, vatAbi, infura);

  const sig = ethers.utils.defaultAbiCoder.encode(['bytes4'], [vat.interface.getSighash('fold')]);
  const eventsFilter = vat.filters.LogNote(sig);

  const blockRanges = rangeChunks(BLOCK_2021, BLOCK_2022 - 1, 10000);

  const folds: Fold[] = [];

  for (const [start, end] of blockRanges) {
    console.error(`Listing fold events for blocks: ${start} - ${end}`);
    const events = await vat.queryFilter(eventsFilter, start, end);
    console.error(`Found: ${events.length}`);

    // Process events in pairs across the two providers; the odd one out (if any)
    // falls back to the secondary endpoint.
    const doubles = pairs(events);
    for (const e of doubles) {
      if (e[1] !== undefined) {
        const [d1, d2] = await Promise.all([processEvent(e[0], vat), processEvent(e[1], vat)]);
        folds.push(d1);
        folds.push(d2);
      } else {
        const d = await processEvent(e[0], vat1);
        folds.push(d);
      }
    }
  }

  printCSV(folds, ['tx', 'block', 'i', 'u', 'rate', 'ilk.Art', 'ilk.rate', 'rad']);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
