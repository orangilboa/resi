import crypto from 'crypto';

const SaltDefaultLength = 200;
const PasswordDefaultLength = 10;

/**
 * hash password with sha256.
 */
export function sha256(data: string, salt: string) {
  const hash = crypto.createHmac('sha256', salt);
  hash.update(data);
  const value = hash.digest('hex');
  return value;
}

/**
 * generates random string of characters i.e salt
 */
export function generateSalt(length: number = 200) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex') /** convert to hexadecimal format */
    .slice(0, length); /** return required number of characters */
}

/**
 * Hashes the given string with a random generated salt
 */
export function hashPassword(plaintextPassword: string = generateSalt(10)) {
  if (!plaintextPassword) {
    plaintextPassword = generateSalt(PasswordDefaultLength);
  }
  let salt = generateSalt(SaltDefaultLength);
  let hash = sha256(plaintextPassword, salt);
  return {
    salt,
    hash,
    originalPassword: plaintextPassword,
  };
}

export function comparePasswords(plaintextPassword: string, hashedPassword: string, salt: string) {
  let equal = sha256(plaintextPassword, salt) === hashedPassword;
  return equal;
}

export const PasswordUtils = {
  sha256,
  generateSalt,
  hashPassword,
  comparePasswords,
};
