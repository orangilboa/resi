import { KeyObject } from 'crypto';
import { AUTH_TOKEN_FIELD } from '../../common/typesConsts';
import { NextFunction, Request, Response } from 'express';
import { ResiToken } from './ResiToken';
import { KeyFile } from './KeyFile';
import { PasswordUtils } from './passwords';

async function extractAndAddResiToken(
  req: Request,
  res: Response,
  next: NextFunction,
  publicKey: KeyObject,
  secret: KeyObject,
) {
  if (req.headers && req.headers.authorization) {
    const signedDecryptedToken = req.headers.authorization.replace('Bearer', '').trim();
    const resiToken = await ResiToken.verifyDecryptToken(signedDecryptedToken, publicKey, secret);
    if (resiToken.expiry > new Date()) {
      res.status(401);
      next('Token expired. Please login');
      return false;
    }
    Object.assign(req, { __resi_token: resiToken });
    return true;
  } else {
    res.status(401);
    next('No authorization header');
    return false;
  }
}

export function makeAuthorizationMiddleware(publicKey: KeyObject, secret: KeyObject) {
  const middleware = async function authorizationMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const success = await extractAndAddResiToken(req, res, next, publicKey, secret);
      if (success) next();
    } catch (e) {
      next(e);
    }
  };

  return middleware;
}

export function makeRoleAuthorizationMiddleware(roles: number[], publicKey: KeyObject, secret: KeyObject) {
  const middleware = async function rolesMiddleware(req: Request, res: Response, next: NextFunction) {
    const reqAny = req as any;

    if (!reqAny.__resi_token) {
      const success = await extractAndAddResiToken(req, res, next, publicKey, secret);
      if (false === success) return;
    }

    const resiToken = reqAny.__resi_token as ResiToken;
    if (resiToken.role) {
      if (roles.includes(resiToken.role)) {
        next();
      } else {
        res.status(401);
        next('Invalid role');
      }
    } else {
      res.status(401);
      next('No role in token');
    }
  };

  return middleware;
}

export function addTokenToResponse<T>(target: T, token: string) {
  (target as any)[AUTH_TOKEN_FIELD] = token;
  return target;
}

export { ResiToken, KeyFile, PasswordUtils };
