import { ethers, utils } from 'ethers';

import vatAbi from './abi/vat.json';
import { rangeChunks } from './chunks';
import { BLOCK_2021, BLOCK_2022, VAT_ADDRESS } from './consts';
import { infuraProvider } from './provider';
import { printCSV } from './csv';
import { hexToAscii } from './hex';

// `frob(ilk, urn, src, dst, dink, dart)` is the core Vat call that opens or
// modifies a vault: `dink` changes locked collateral, `dart` changes drawn
// debt. It is emitted as a `LogNote` whose calldata we decode below.
const frobIf = new utils.Interface([
  'function frob(bytes32,address,address,address,int256,int256)',
]);

export type EventLog = {
  tx: string;
  block: string;
  timestamp?: string;
};

export type Frob = EventLog & {
  i: string;
  u: string;
  v: string;
  w: string;
  dink: string;
  dart: string;
};

async function main() {
  const provider = infuraProvider();
  const vat = new ethers.Contract(VAT_ADDRESS, vatAbi, provider);

  const sig = ethers.utils.defaultAbiCoder.encode(['bytes4'], [vat.interface.getSighash('frob')]);
  const eventsFilter = vat.filters.LogNote(sig);

  const blockRanges = rangeChunks(BLOCK_2021, BLOCK_2022, 10000);

  const frobs: Frob[] = [];

  for (const [start, end] of blockRanges) {
    console.error(`Listing frob events for blocks: ${start} - ${end}`);
    const events = await vat.queryFilter(eventsFilter, start, end);

    for (const event of events) {
      const tx = event.transactionHash;
      const block = event.blockNumber;

      // Skip the 4-byte selector + arg padding and decode the raw `frob` calldata.
      const data = utils.hexDataSlice(event.data, 64);
      const parsed = frobIf.decodeFunctionData('frob', data);
      const [, u, v, w] = parsed;
      const i = hexToAscii(parsed[0]);
      const dink = utils.formatEther(parsed[4]);
      const dart = utils.formatEther(parsed[5]);
      frobs.push({ tx, block: block.toString(), i, u, v, w, dink, dart });
    }
  }

  printCSV(frobs, ['tx', 'block', 'i', 'u', 'v', 'w', 'dink', 'dart']);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
