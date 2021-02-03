import { Handler, NextFunction, Request, Response, Router } from 'express';

import { iterateFunctionsAndParams } from '../common/functionParsing';
import { PLUGS, checkPlug } from '../common/plugs';
import { ResiAPIImplementation, ResiHandler, ResiSecurity } from '../common/typesConsts';
import { mergeOptions } from '../common/utils';
import { CreateServerOptions, CreateServerUserOptions } from './createServer';
import { makeRoleAuthorizationMiddleware } from './security';

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
  options: AddAPIToRouterOptions & CreateServerUserOptions = defaultOptions,
) {
  const optionsFinal: AddAPIToRouterOptionsMerged & CreateServerOptions = mergeOptions(options, defaultOptions);

  let { logger } = optionsFinal;
  logger = logger || console;

  // logger.log('apiImplementation', apiImplementation);
  for (const apiName in resiAPIImplementation) {
    const api = resiAPIImplementation[apiName];
    const apiAuthorization = checkPlug(api, PLUGS.withAuthorization);
    const apiRoles = (api.__authorized_roles as unknown) as number[];
    const apiHasRolesAuth = checkPlug(api, PLUGS.roleAuthorization);
    const apiHasPrepend = checkPlug(api, PLUGS.prependMiddleware);
    const apiHasAppend = checkPlug(api, PLUGS.appendMiddleware);

    logger.debug('api', apiName);
    for (const { func, params } of iterateFunctionsAndParams(resiAPIImplementation[apiName])) {
      const path = '/' + apiName + '/' + func;
      logger.debug('path', { api: apiName, func });
      const funcImpl = api[func] as ResiHandler;
      funcImpl.__params = params;
      const httpAction = checkPlug(funcImpl, PLUGS.httpGet) ? 'get' : 'post';

      const handlers: Handler[] = [];
      const addHandler = (handler: Handler) => handlers.push(handler);

      if (
        (checkPlug(funcImpl, PLUGS.withAuthorization) || apiAuthorization) &&
        optionsFinal.security &&
        optionsFinal.authorizationMiddleware
      ) {
        logger.info('Adding authorization middleware', { path, httpAction });
        handlers.push(optionsFinal.authorizationMiddleware);
      }

      let rolesAuthorization: number[] = [];
      if (apiHasRolesAuth) {
        rolesAuthorization.push(...apiRoles);
      }

      if (checkPlug(funcImpl, PLUGS.roleAuthorization)) {
        rolesAuthorization.push(...funcImpl.__authorized_roles);
      }

      if (rolesAuthorization.length > 0 && optionsFinal.makeRoleAuthorizationMiddleware) {
        logger.info('Adding role authorization', { path, httpAction });

        handlers.push(optionsFinal.makeRoleAuthorizationMiddleware(rolesAuthorization));
      }

      if (apiHasPrepend || checkPlug(funcImpl, PLUGS.prependMiddleware)) {
        if (api.__prepend_middleware_handlers)
          ((api.__prepend_middleware_handlers as unknown) as Handler[]).forEach(addHandler);

        if (funcImpl.__prepend_middleware_handlers) funcImpl.__prepend_middleware_handlers.forEach(addHandler);
      }

      handlers.push(function (req, res, next) {
        // logger.debug('INCOMING', { path });
        const args = checkPlug(funcImpl, PLUGS.customRequestBody) ? [req.body] : req.body.args || [];

        try {
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

      if (apiHasAppend || checkPlug(funcImpl, PLUGS.appendMiddleware)) {
        if (api.__append_middleware_handlers)
          ((api.__append_middleware_handlers as unknown) as Handler[]).forEach(addHandler);

        if (funcImpl.__append_middleware_handlers) funcImpl.__append_middleware_handlers.forEach(addHandler);
      }

      router[httpAction](path, ...handlers);
    }
  }
}
