import paseto from 'paseto';
import { KeyObject } from 'crypto';

const {
  V2: { decrypt, encrypt, sign, verify },
} = paseto;

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

  async encryptSign(privateKey: KeyObject, secret: KeyObject) {
    const payloadForEncryption = Object.assign({}, this);
    const encryptedToken = await encrypt(payloadForEncryption, secret);
    const token = await sign({ payload: encryptedToken }, privateKey);
    return token;
  }

  constructor(userId?: string | number) {
    this.userId = userId || 0;
  }

  userId: string | number;

  mergeToken(token: object) {
    Object.assign(this, token);
  }
}
