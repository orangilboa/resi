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
}

export class ResiToken {
  /**
   *
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

  async encryptSign(privateKey: Buffer, secret: Buffer) {
    const payloadForEncryption = Object.assign({}, this);
    const encryptedToken = await encrypt(payloadForEncryption, secret);
    const token = await sign({ payload: encryptedToken }, privateKey as any);
    return token;
  }

  async addToResponse<T, TTarget>(context: ResiContext<T>, response: TTarget) {
    const tokenStr = await this.encryptSign(context.resiOptions.security.privateKey, context.resiOptions.security.secret);
    addTokenToResponse(response, tokenStr);
    return response;
  }

  constructor(userId?: string | number, role?: number, expiry = makeDefaultExpiry()) {
    this.userId = userId || 0;
    this.role = role;
    this.expiry = expiry;
  }

  userId: string | number;
  role?: number;
  expiry: Date;

  mergeToken(token: object) {
    Object.assign(this, token);
  }
}
