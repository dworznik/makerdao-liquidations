import { Address } from 'events/dog';
import { isLeft, isRight } from 'fp-ts/Either';

describe('Address codec', () => {
  it('accepts a well-formed 20-byte address', () => {
    expect(isRight(Address.decode(`0x${'a'.repeat(40)}`))).toBe(true);
  });

  it('rejects a non-address string', () => {
    expect(isLeft(Address.decode('urn'))).toBe(true);
  });

  it('rejects a hex string of the wrong length', () => {
    expect(isLeft(Address.decode('0x1234'))).toBe(true);
  });
});
