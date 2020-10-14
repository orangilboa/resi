import { NextFunction, Request, Response, Router } from 'express';

import { iterateFunctionsAndParams } from '../common/functionParsing';
import { PLUGS, checkPlug } from '../common/plugs';
import { ResiAPIImplementation, ResiHandler, ResiSecurity } from '../common/typesConsts';
import { mergeOptions } from '../common/utils';
import { makeAuthorizationMiddleware } from './security';
import crypto from 'crypto';

const securityDefault: ResiSecurity = {
  privateKey: Buffer.from(''),
  publicKey: Buffer.from(''),
  secret: Buffer.from(''),
};
export const defaultOptions = {
  resBodyHandler(resBody: object, res: Response, next: NextFunction) {
    if (resBody) {
      res.send(JSON.stringify(resBody));
    } else res.end();
    if (next) {
      next();
    }
  },

  errorHandler(error: any, res: Response, next: NextFunction) {
    if (next) next(error);
    else res.send(error);
  },

  security: securityDefault,
  logger: console,
};

export type AddAPIToRouterOptions = {
  [key in keyof typeof defaultOptions]?: typeof defaultOptions[key];
};

export type AddAPIToRouterOptionsMerged = {
  [key in keyof typeof defaultOptions]: typeof defaultOptions[key];
};

const getArg = (param: string, req: Request) => req.body[param];
const makeGetArg = (req: Request) => (param: string) => getArg(param, req);

function enrichContext(func: any, key: string, value: any) {
  func[key] = value;
}

export function addAPIToRouter(
  router: Router,
  resiAPIImplementation: ResiAPIImplementation,
  options: AddAPIToRouterOptions = defaultOptions,
) {
  const optionsFinal: AddAPIToRouterOptionsMerged = mergeOptions(options, defaultOptions);
  const publicKey = crypto.createPublicKey(optionsFinal.security.publicKey);
  const secret = crypto.createSecretKey(optionsFinal.security.secret);

  const { logger } = optionsFinal;

  // logger.log('apiImplementation', apiImplementation);
  for (const apiName in resiAPIImplementation) {
    const api = resiAPIImplementation[apiName];
    // if (checkPlug(api, PLUGS.withAuthorization) && optionsFinal.security) {
    //   router.post(`/${apiName}`, makeAuthorizationMiddleware(publicKey, secret));
    // }
    logger.debug('api', apiName);
    for (const { func, params } of iterateFunctionsAndParams(resiAPIImplementation[apiName])) {
      const path = '/' + apiName + '/' + func;
      logger.debug('path', { api: apiName, func });
      const funcImpl = api[func] as ResiHandler;
      funcImpl.__params = params;
      const httpAction = checkPlug(funcImpl, PLUGS.httpGet) ? 'get' : 'post';
      if (
        (checkPlug(funcImpl, PLUGS.withAuthorization) || checkPlug(api, PLUGS.withAuthorization)) &&
        optionsFinal.security
      ) {
        router[httpAction](path, makeAuthorizationMiddleware(publicKey, secret));
      }
      router[httpAction](path, function (req, res, next) {
        logger.debug('INCOMING', { path, body: req.body });
        const args = req.body.args || [];

        logger.debug('args', args);
        try {
          // if (!funcImpl.__context) funcImpl.__context = {};
          const context = { token: (req as any).__resi_token, resiOptions: optionsFinal };

          enrichContext(context, 'req', req);
          enrichContext(context, 'res', res);
          if (checkPlug(funcImpl, PLUGS.streamResponse)) {
            enrichContext(context, 'writeStream', (chunk: string | Buffer) => res.write(chunk));
          }
          args.push(context);
          const resOrPromise = funcImpl.apply(api, args);
          if (!resOrPromise) {
            optionsFinal.resBodyHandler(resOrPromise, res, next);
          } else if (resOrPromise.then) {
            resOrPromise
              .then((responseBody: object) => optionsFinal.resBodyHandler(responseBody, res, next))
              .catch((error: any) => optionsFinal.errorHandler(error, res, next));
          } else {
            optionsFinal.resBodyHandler(resOrPromise, res, next);
          }
        } catch (error) {
          optionsFinal.errorHandler(error, res, next);
        }
      });
    }
  }
}
