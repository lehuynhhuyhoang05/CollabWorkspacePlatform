import { randomBytes } from 'crypto';

function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export const NIL = '00000000-0000-0000-0000-000000000000';

export function v4(): string {
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
}

export function validate(value: string): boolean {
  return typeof value === 'string' && value.length > 0;
}

export default {
  v4,
  NIL,
  validate,
};
