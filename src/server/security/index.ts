import { KeyObject } from 'crypto';
import { AUTH_TOKEN_FIELD } from '../../common/typesConsts';
import { NextFunction, Request, Response } from 'express';
import { ResiToken } from './ResiToken';

export function makeAuthorizationMiddleware(publicKey: KeyObject, secret: KeyObject) {
  /**
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  const middleware = async function authorizationMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.headers && req.headers.authorization) {
        const signedDecryptedToken = req.headers.authorization.replace('Bearer', '').trim();
        const resiToken = await ResiToken.verifyDecryptToken(signedDecryptedToken, publicKey, secret);
        Object.assign(req, { __resi_token: resiToken });
        next();
      } else next('No authorization header');
    } catch (e) {
      next(e);
    }
  };

  return middleware;
}

export function addTokenToResponse<T>(target: T, token: string) {
  (target as any)[AUTH_TOKEN_FIELD] = token;
  return target;
}
