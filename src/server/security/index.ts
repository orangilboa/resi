import { KeyObject } from 'crypto';
import { AUTH_TOKEN_FIELD } from '../../common/typesConsts';
import { NextFunction, Request, Response } from 'express';
import { ResiToken } from './ResiToken';
import { STATUS_CODES } from 'http';

export function makeAuthorizationMiddleware(publicKey: KeyObject, secret: KeyObject) {
  const middleware = async function authorizationMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.headers && req.headers.authorization) {
        const signedDecryptedToken = req.headers.authorization.replace('Bearer', '').trim();
        const resiToken = await ResiToken.verifyDecryptToken(signedDecryptedToken, publicKey, secret);
        if (resiToken.expiry > new Date()) {
          res.status(401);
          next('Token expired. Please login');
          return;
        }
        Object.assign(req, { __resi_token: resiToken });
        next();
      } else {
        res.status(401);
        next('No authorization header');
      }
    } catch (e) {
      next(e);
    }
  };

  return middleware;
}

export function makeRoleAuthorizationMiddleware(roles: number[]) {
  const middleware = function rolesMiddleware(req: Request, res: Response, next: NextFunction) {
    const reqAny = req as any;
    if (!reqAny.__resi_token) {
      next('No token in request');
      return;
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
