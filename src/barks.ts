import { utils, Contract, BigNumberish, Event } from 'ethers';
import fromUnixTime from 'date-fns/fromUnixTime';
import format from 'date-fns/format';
import { Filter } from '@ethersproject/providers';
import { LogDescription } from '@ethersproject/abi';

import vatAbi from './abi/vat.json';
import dogAbi from './abi/dog.json';
import clipAbi from './abi/clip.json';
import { infuraProvider } from './provider';
import { rangeChunks } from './chunks';
import { BLOCK_2021, BLOCK_2022, DOG_ADDRESS, VAT_ADDRESS } from './consts';
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

export type Bark = {
    ilk: string;
    urn: string;
    ink: BigNumberish;
    art: BigNumberish;
    due: BigNumberish;
    clip: string;
    id: BigNumberish;
};

export type Kick = {
    id: BigNumberish,
    top: BigNumberish, //  
    tab: BigNumberish, // rad
    lot: BigNumberish, // wad
    usr: string,
    kpr: string,
    coin: BigNumberish;
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

export type DogIlk = {
    clip: string;  // Liquidator
    chop: BigNumberish;  // Liquidation Penalty                                          [wad]
    hole: BigNumberish;  // Max DAI needed to cover debt+fees of active auctions per ilk [rad]
    dirt: BigNumberish;  // Amt DAI needed to cover debt+fees of active auctions per ilk [rad]
};

export type Urn = {
    ink: BigNumberish; // wad
    art: BigNumberish; // wad
};

export type FullBite = EventLog & Bite & {
    vat: VatIlk & Urn,
    urn0: Urn,
    cat: CatIlk;
};

export type FullBark = EventLog & Bark & {
    vat: VatIlk & Urn,
    urn0: Urn,
    dog: DogIlk;
};

export type BarkAndKick = EventLog & {
    bark: Bark;
    kick: Kick;
    vat: VatIlk;
    dog: DogIlk;
    urn0: Urn; // vault state in the block before the bark
    urn: Urn;  // vault state at the bark
};

// Liquidation 2.0 surfaces event args untyped; this maps the fields we care
// about onto a typed shape. Named "unsafe" because the cast is unchecked.
export const unsafeTypedEvent = <T>(fields: Extract<keyof T, string>[]) => (event: Event | LogDescription) =>
    Object.fromEntries(fields.map(x => [x, event.args![x]])) as T;

const unsafeBark = unsafeTypedEvent(['ilk', 'urn', 'ink', 'art', 'due', 'clip', 'id']) as (x: Event | LogDescription) => Bark;

const unsafeKick = unsafeTypedEvent(['id', 'top', 'tab', 'lot', 'usr', 'kpr', 'coin']) as (x: Event | LogDescription) => Kick;

async function main() {
    const provider = infuraProvider();
    const dog = new Contract(DOG_ADDRESS, dogAbi, provider);
    const vat = new Contract(VAT_ADDRESS, vatAbi, provider);
    const clip = new Contract('0x0', clipAbi, provider);

    // const blockRanges = rangeChunks(13716435, 13716435, 10000);
    const blockRanges = rangeChunks(BLOCK_2021, BLOCK_2022 - 1, 10000);

    const eventsFilter = dog.filters.Bark();

    const kickFilter = clip.filters.Kick();
    kickFilter.address = undefined;

    const barks: BarkAndKick[] = [];

    for (const [start, end] of blockRanges) {
        console.error(`Listing bark events for blocks: ${start} - ${end}`);
        const events = await dog.queryFilter(eventsFilter, start, end);
        console.error(`${events.length} bark events found`);


        for (const event of events) {
            const tx = event.transactionHash;
            const block = event.blockNumber;
            const bark = unsafeBark(event);

            const [vatIlk, dogIlk, urnBefore, urn, blockData] = await Promise.all([vat.ilks(bark.ilk, { blockTag: block }), dog.ilks(bark.ilk, { blockTag: block }), vat.urns(bark.ilk, bark.urn, { blockTag: block - 1 }), vat.urns(bark.ilk, bark.urn, { blockTag: block }), provider.getBlock(block)]);

            const filter = kickFilter as Filter;
            filter.fromBlock = block;
            filter.toBlock = block;

            // Match the Clipper auction kicked off by this bark on (id, lot).
            const kicks = (await provider.getLogs(filter)).map(x => clip.interface.parseLog(x)).map(unsafeKick);
            const kick = kicks.filter(x => bark.ink.toString() === x.lot.toString() && x.id.toString() === bark.id.toString())[0];

            const bk: BarkAndKick = {
                tx,
                block,
                timestamp: format(fromUnixTime(blockData.timestamp), 'yyyy-MM-dd hh:mm:ss'),
                bark: {
                    ilk: hexToAscii(bark.ilk),
                    urn: bark.urn,
                    ink: utils.formatUnits(bark.ink),
                    art: utils.formatUnits(bark.art),
                    due: utils.formatUnits(bark.due, 45),
                    clip: bark.clip,
                    id: bark.id.toString(),
                },
                kick: {
                    id: kick.id.toString(),
                    top: utils.formatUnits(kick.top),
                    tab: utils.formatUnits(kick.tab, 45),
                    lot: utils.formatUnits(kick.lot),
                    usr: utils.formatUnits(kick.usr),
                    kpr: utils.formatUnits(kick.kpr),
                    coin: utils.formatUnits(kick.coin)
                },
                vat: {
                    Art: utils.formatUnits(vatIlk.Art),
                    rate: utils.formatUnits(vatIlk.rate, 27),
                    spot: utils.formatUnits(vatIlk.spot, 27),
                    line: utils.formatUnits(vatIlk.line, 45),
                    dust: utils.formatUnits(vatIlk.dust, 45)
                },
                dog: {
                    clip: dogIlk.clip,
                    chop: utils.formatUnits(dogIlk.chop),
                    hole: utils.formatUnits(dogIlk.hole, 45),
                    dirt: utils.formatUnits(dogIlk.dirt, 45)
                },
                urn0: {
                    ink: utils.formatUnits(urnBefore.ink),
                    art: utils.formatUnits(urnBefore.art)
                },
                urn: {
                    ink: utils.formatUnits(urn.ink),
                    art: utils.formatUnits(urn.art)
                }
            };

            barks.push(bk);
        }
    }

    printCSV(barks, ['tx', 'block', 'timestamp', 'bark.urn', 'bark.ilk', 'bark.ink', 'bark.art', 'bark.due', 'kick.id', 'kick.lot', 'kick.tab', 'dog.chop', 'vat.rate', 'vat.spot', 'urn0.ink', 'urn0.art', 'urn.ink', 'urn.art']);

}
main().catch(e => {
    console.error(e);
    process.exit(1);
});

