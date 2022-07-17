import { utils, Contract, BigNumberish, Event } from 'ethers';
import fromUnixTime from 'date-fns/fromUnixTime';
import format from 'date-fns/format';
import { LogDescription } from '@ethersproject/abi';
import { Filter } from '@ethersproject/providers';

import catAbi from './abi/cat.json';
import vatAbi from './abi/vat.json';
import flipAbi from './abi/flip.json';
import { infuraProvider } from './provider';
import { rangeChunks } from './chunks';
import { BLOCK_2022, BLOCK_2023, CAT_ADDRESS, VAT_ADDRESS } from './consts';
import { printCSV } from './csv';
import { hexToAscii } from './hex';


export type EventLog = {
    tx: string;
    block: number;
    timestamp?: string;
};

export type Bite = {
    ilk: string;
    urn: string;
    ink: BigNumberish;
    art: BigNumberish;
    tab: BigNumberish;
    flip: string;
    id: BigNumberish;
};

export type Kick = {
    id: BigNumberish,
    lot: BigNumberish, //  
    bid: BigNumberish, // rad
    tab: BigNumberish, // wad
    usr: string,
    gal: string;
};

export type VatIlk = {
    Art: BigNumberish; // wad
    rate: BigNumberish; // ray
    spot: BigNumberish; // ray
    line: BigNumberish; // rad
    dust: BigNumberish; // rad
};

export type CatIlk = {
    flip: string;
    chop: BigNumberish; // wad
    dunk: BigNumberish; // rad
};

export type Urn = {
    ink: BigNumberish; // wad
    art: BigNumberish; // wad
};

export type FullBite = EventLog & Bite & {
    vat: VatIlk & Urn,
    cat: CatIlk;
};

export type BiteAndKick = EventLog & {
    bite: Bite;
    kick: Kick;
    cat: CatIlk,
    vat: VatIlk;
};
// Liquidation 1.0 surfaces event args untyped; this maps the fields we care
// about onto a typed shape. Named "unsafe" because the cast is unchecked.
export const unsafeTypedEvent = <T>(fields: Extract<keyof T, string>[]) => (event: Event | LogDescription) =>
    Object.fromEntries(fields.map(x => [x, event.args![x]])) as T;

const unsafeBite = unsafeTypedEvent(['ilk', 'urn', 'ink', 'art', 'tab', 'flip', 'id']) as (x: Event | LogDescription) => Bite;

const unsafeKick = unsafeTypedEvent(['id', 'bid', 'tab', 'lot', 'usr', 'gal']) as (x: Event | LogDescription) => Kick;

async function main() {
    const provider = infuraProvider();
    const cat = new Contract(CAT_ADDRESS, catAbi, provider);
    const vat = new Contract(VAT_ADDRESS, vatAbi, provider);
    const flip = new Contract('0x0', flipAbi, provider);

    const blockRanges = rangeChunks(BLOCK_2022, BLOCK_2023 - 1, 10000);
    // const blockRanges = rangeChunks(BLOCK_2021, BLOCK_2021 + 10000, 10000);

    const eventsFilter = cat.filters.Bite();

    const kickFilter = flip.filters.Kick();
    kickFilter.address = undefined;

    const bites: BiteAndKick[] = [];

    for (const [start, end] of blockRanges) {
        console.error(`Listing bite events for blocks: ${start} - ${end}`);
        const events = await cat.queryFilter(eventsFilter, start, end);
        console.error(`${events.length} bite events found`);


        for (const event of events) {
            const tx = event.transactionHash;
            const block = event.blockNumber;
            const bite = unsafeBite(event);

            const [vatIlk, catIlk, blockData] = await Promise.all([vat.ilks(bite.ilk, { blockTag: block }), cat.ilks(bite.ilk, { blockTag: block }), provider.getBlock(block)]);

            const filter = kickFilter as Filter;
            filter.fromBlock = block;
            filter.toBlock = block;

            const kicks = (await provider.getLogs(filter)).map(x => flip.interface.parseLog(x)).map(unsafeKick);
            const kick = kicks.filter(x => bite.ink.toString() === x.lot.toString() && x.id.toString() === bite.id.toString())[0];

            const bk: BiteAndKick = {
                tx,
                block,
                timestamp: format(fromUnixTime(blockData.timestamp), 'yyyy-MM-dd hh:mm:ss'),
                bite: {
                    ilk: hexToAscii(bite.ilk),
                    urn: bite.urn,
                    ink: utils.formatUnits(bite.ink),
                    art: utils.formatUnits(bite.art),
                    tab: utils.formatUnits(bite.tab, 45),
                    flip: bite.flip,
                    id: bite.id.toString(),
                },
                kick: {
                    id: kick.id.toString(),
                    bid: utils.formatUnits(kick.bid),
                    tab: utils.formatUnits(kick.tab, 45),
                    lot: utils.formatUnits(kick.lot),
                    usr: utils.formatUnits(kick.usr),
                    gal: utils.formatUnits(kick.gal)
                },
                vat: {
                    Art: utils.formatUnits(vatIlk.Art),
                    rate: utils.formatUnits(vatIlk.rate, 27),
                    spot: utils.formatUnits(vatIlk.spot, 27),
                    line: utils.formatUnits(vatIlk.line, 45),
                    dust: utils.formatUnits(vatIlk.dust, 45)
                },
                cat: {
                    flip: catIlk.flip,
                    chop: utils.formatUnits(catIlk.chop),
                    dunk: utils.formatUnits(catIlk.dunk, 45)
                }
            };
            bites.push(bk);
        }
    }

    printCSV(bites, ['tx', 'block', 'timestamp', 'bite.urn', 'bite.ilk', 'bite.ink', 'bite.art', 'bite.tab', 'bite.id', 'kick.bid', 'kick.tab', 'kick.lot', 'cat.chop', 'cat.dunk', 'vat.rate', 'vat.spot', 'vat.line', 'vat.dust', 'vat.ink']);

}
main().catch(e => {
    console.error(e);
    process.exit(1);
});

