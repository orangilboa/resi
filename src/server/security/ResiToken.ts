import paseto from 'paseto';
import { KeyObject } from 'crypto';
import { addTokenToResponse } from '.';
import { ResiContext } from '../createServer';

const {
  V2: { decrypt, encrypt, sign, verify },
} = paseto;

const makeDefaultExpiry = () => {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return now;
};

/**
 * Use this class to create and serve tokens to your clients, either by direct usage or by inheritance (thus creating your custom token)
 */
export class ResiToken {
  constructor(userId?: string | number, role?: number, expiry = makeDefaultExpiry()) {
    this.userId = userId || 0;
    this.role = role;
    this.expiry = expiry;
  }

  userId: string | number;
  role?: number;
  expiry: Date;

  /**
   * Verify an encrypted and signed ResiToken. This is useful for authorizing incoming requests from Resi clients
   * @param {string} signedEncryptedToken
   * @param {crypto.KeyObject} publicKey
   * @param {crypto.KeyObject} secret
   */
  static async verifyDecryptToken(signedEncryptedToken: string, publicKey: KeyObject, secret: KeyObject) {
    const encryptedToken = (await verify(signedEncryptedToken, publicKey)) as any;
    const token = await decrypt(encryptedToken.payload, secret);
    const resiToken = new ResiToken();
    resiToken.mergeToken(token);
    return resiToken;
  }

  /**
   * Encrypt and sign a raw Resi Token, making it ready to be used for secured authorized connections
   */
  async encryptSign(privateKey: Buffer, secret: Buffer) {
    const payloadForEncryption = Object.assign({}, this);
    const encryptedToken = await encrypt(payloadForEncryption, secret);
    const token = await sign({ payload: encryptedToken }, privateKey as any);
    return token;
  }

  async addToResponse<T, TTarget>(context: ResiContext<T>, response: TTarget) {
    const tokenStr = await this.encryptSign(
      context.resiOptions.security.privateKey,
      context.resiOptions.security.secret,
    );
    addTokenToResponse(response, tokenStr);
    return response;
  }

  mergeToken(token: object) {
    Object.assign(this, token);
  }

  setMinutesExpiry(minutesFromNow: number) {
    this.expiry = new Date();
    this.expiry.setMinutes(this.expiry.getMinutes() + minutesFromNow);
  }

  setHoursExpiry(hoursFromNow: number) {
    this.expiry = new Date();
    this.expiry.setHours(this.expiry.getHours() + hoursFromNow);
  }

  setDaysExpiry(daysFromNow: number) {
    this.expiry = new Date();
    this.expiry.setDate(this.expiry.getDate() + daysFromNow);
  }

  setWeeksExpiry(weeksFromNow: number) {
    this.expiry = new Date();
    this.expiry.setDate(this.expiry.getDate() + weeksFromNow * 7);
  }

  setMonthsExpiry(monthsFromNow: number) {
    this.expiry = new Date();
    this.expiry.setMonth(this.expiry.getMonth() + monthsFromNow);
  }
}
