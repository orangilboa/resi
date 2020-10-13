#!/usr/bin/env node

import crypto from 'crypto';
import path from 'path';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import paseto from 'paseto';

const generateKeyPair = promisify(crypto.generateKeyPair);

const {
  V2: { generateKey },
} = paseto;

async function createKeySet(dir: string) {
  await fs.mkdir(dir, { recursive: true });

  console.log('Generating secret');
  const secret = await generateKey('local');
  const secretPath = path.join(dir, 'secret');
  await fs.writeFile(secretPath, secret.export());
  console.log('Written secret', { path: secretPath, content: secret });

  console.log('Generating key pair');
  // const { privateKey, publicKey } = await generateKeyPair('rsa', {
  //   modulusLength: 4096,
  //   publicKeyEncoding: {
  //     type: 'spki',
  //     format: 'pem',
  //   },
  //   privateKeyEncoding: {
  //     type: 'pkcs8',
  //     format: 'pem',
  //     cipher: 'aes-256-cbc',
  //     passphrase: 'k2aSJDKLOP1DP1J!@E!@Dhjjk29i3!@#E!@djklnnbfdsaocoDw118299d',
  //   },
  // });

  const { privateKey, publicKey } = await generateKeyPair('ed25519');
  //   const privateKey = await generateKey('public');
  console.log('privateKey, publicKey', privateKey, publicKey);
  const privatePath = path.join(dir, 'private');
  const publicPath = path.join(dir, 'public');
  // await fs.writeFile(privatePath, privateKey);
  await fs.writeFile(privatePath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  console.log('Written private key', { path: privatePath, content: privateKey });
  // await fs.writeFile(publicPath, publicKey);
  await fs.writeFile(publicPath, publicKey.export({ format: 'pem', type: 'spki' }));
  console.log('Written public key', { path: publicPath, content: publicKey });
}

const DIR = process.env.DIR || process.argv[process.argv.length - 1];

createKeySet(DIR).then(() => console.log('Keys Created!'));
