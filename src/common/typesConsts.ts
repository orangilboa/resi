import { KeyObject } from 'crypto';

export type ResiAPIImplementation = {
  [api: string]: APIImplementation;
};

export type APIImplementation = {
  [func: string]: ResiHandler | string;
  name: string;
};

export type ResiHandler = Function & { [key: string]: boolean | any; __params?: string[] };

export type ResiSecurityKeyType = 'privateKey' | 'publicKey' | 'secret';
export type ResiSecurity = {
  [key in ResiSecurityKeyType]: Buffer;
};
export type ResiSecurityPaths = {
  [key in ResiSecurityKeyType]: string;
};

export const API_DIRECTORY = 'apis';
export const MODELS_DIRECTORY = 'models';
export const AUTH_TOKEN_FIELD = 'auth_token';
export const RESI_ROUTE = 'resi';
