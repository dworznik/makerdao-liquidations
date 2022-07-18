import { parseFixed } from '@ethersproject/bignumber';
import { Bark, bigNumberish } from 'events/dog';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/lib/function';
import * as DE from 'io-ts/DecodeError';
import * as FS from 'io-ts/FreeSemigroup';


test('Bark', () => {
    const u = {
        urn: 'urn',
        ink: parseFixed('10.42', 2),
        art: parseFixed('10.42', 2),
        due: parseFixed('10.42', 2),
        clip: 'clip',
        id: parseFixed('1000', 0)
    };
    const b = Bark.decode(u);
    expect(b).toEqual(E.right(u));

    pipe(
        b,
        E.fold(
            e => console.log(e),
            x => console.log(x.ink.toString())
        ));
});


test('Not a bark', () => {
    expect(Bark.decode({ dupa: 1 })._tag).toEqual('Left');
});
