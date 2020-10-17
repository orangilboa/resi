import express, { Router, Express, Request, NextFunction, Response, Handler } from 'express';
import { Server } from 'http';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import cors from 'cors';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import { mergeOptions } from '../common/utils';
import { addAPIToRouter } from './mapAPIToRouter';
import { enrich, streamResponse } from '../common/plugs';
import { buildClientFileCommands } from './buildClient';
import { BUILD_CLIENT_API } from '../common/clientBuildCommon';
import { ResiAPIImplementation, ResiHandler, ResiSecurity, RESI_ROUTE } from '../common/typesConsts';
import { serverRunningMessage } from './serverRunning';
import { ResiToken } from './security/ResiToken';
import { makeAuthorizationMiddleware } from './security';

export const reqToLog = (req: Request) => ({
  headers: req.headers,
  body: req.body,
  query: req.query,
  path: req.path,
  accepted: req.accepted,
});

export type ResiContext<TToken = ResiToken> = {
  req: Request;
  res: Response;
  writeStream?: (chunk: Buffer | string) => void;
  token: TToken;
  resiOptions: CreateServerOptions;
};

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
// app.set('trust proxy', 1);

//  apply to all requests

function createSuccessAndErrorHandlers(app: Express, logger: any) {
  // development error handler
  // will print stacktrace
  if (app.get('env') === 'development') {
    app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
      if (res.headersSent) {
        return next(err);
      }

      if (err.sql) err.message += ' SQL: ' + err.sql;

      res.status(err.status || 500).send({
        message: err,
        error: err.message,
      });
    });
  }

  // production error handler
  // no stacktraces leaked to user
  app.use(function (err: any, req: Request, res: Response & { body?: object }, next: NextFunction) {
    if (res.headersSent) {
      return next(err);
    }

    logger.error('GENERAL ERROR REPORT', {
      error: err,
      req: reqToLog(req),
      res: { body: res.body },
    });

    res.status(err.status || 500).send({
      message: {},
      error: err.message,
    });
  });
}

export type CreateServerOptions = {
  logger: Console;
  apiPrefix: string;
  port: number;
  bodyLimit: string;
  security: ResiSecurity;
  authorizationMiddleware: Handler;
  hookSetup: (
    app: Express,
    router: Router,
    apiImplementation: ResiAPIImplementation,
    options: CreateServerOptions,
  ) => Promise<void>;
  setup: (
    app: Express,
    router: Router,
    apiImplementation: ResiAPIImplementation,
    options: CreateServerOptions,
  ) => Promise<void>;
  hookStart: (app: Express, router: Router, options: CreateServerOptions) => Promise<void>;
  start: (app: Express, router: Router, options: CreateServerOptions) => Promise<Server>;
  hookSetRoutes: (
    app: Express,
    router: Router,
    apiImplementation: ResiAPIImplementation,
    options: CreateServerOptions,
  ) => Promise<void>;
  setRoutes: (
    app: Express,
    router: Router,
    apiImplementation: ResiAPIImplementation,
    options: CreateServerOptions,
  ) => Promise<void>;
};

export type CreateServerUserOptions = {
  [key in keyof CreateServerOptions]?: CreateServerOptions[key];
}

const defaultOptions: CreateServerOptions = {
  logger: console,
  apiPrefix: RESI_ROUTE,
  port: 80,
  bodyLimit: '16mb',
  security: {
    publicKey: Buffer.from(''),
    privateKey: Buffer.from(''),
    secret: Buffer.from(''),
  },
  authorizationMiddleware: (req, res, next) =>  next(),
  async hookSetup(app: Express, router: Router) {
    return;
  },
  /**
   *
   * @param {import('express').Express} app
   */
  async setup(
    app: Express,
    router: Router,
    resiAPIImplementation: ResiAPIImplementation,
    options: CreateServerOptions,
  ) {
    await options.hookSetup(app, router, resiAPIImplementation, options);
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    });

    app.use(limiter, morgan('dev'), cors(), bodyParser.json({ limit: options.bodyLimit }));

    await options.setRoutes(app, router, resiAPIImplementation, options);
    app.use(`/${options.apiPrefix}`, router);

    createSuccessAndErrorHandlers(app, options.logger);
  },

  async hookStart(app, router, options) {
    return;
  },

  start(app: Express, router: Router, options: CreateServerOptions): Promise<Server> {
    return new Promise((resolve, reject) => {
      try {
        const server = app.listen(options.port, () => {
          options.logger.info(`Listening on port ${options.port}`);
          resolve(server);
        });
      } catch (e) {
        reject(e);
      }
    });
  },
  async hookSetRoutes(app, router, apiImplementation) {
    return;
  },

  async setRoutes(app, router, apiImplementation, options) {
    await options.hookSetRoutes(app, router, apiImplementation, options);
    addAPIToRouter(router, apiImplementation, options);
  },
};

export async function createServer(resiAPIImplementation: ResiAPIImplementation, options = defaultOptions) {
  const mergedOptions = mergeOptions(options, defaultOptions);
  if (options.security) {
    const publicKey = crypto.createPublicKey(options.security.publicKey);
    const secret = crypto.createSecretKey(options.security.secret);
    mergedOptions.authorizationMiddleware = makeAuthorizationMiddleware(publicKey, secret);
  }
  const { setup, start, logger } = mergedOptions;

  const app = express();
  const router = Router();

  await setup(app, router, resiAPIImplementation, mergedOptions);
  const server = await start(app, router, mergedOptions);
  logger.info(serverRunningMessage(mergedOptions, resiAPIImplementation));
  return server;
}

async function getPathsFromDir(dir: string) {
  const files = await fs.readdir(dir);
  return files.filter((f) => false === f.includes('js.map')).map((f) => path.join(dir, f));
}

export async function createServerFromResiDir(
  modelsDirectory: string,
  apisDirectory: string,
  distDir = 'src',
  options = defaultOptions,
) {
  const apiFiles = await getPathsFromDir(apisDirectory);
  const modelFiles = await getPathsFromDir(modelsDirectory);
  const resiAPIImplementation: ResiAPIImplementation = Object.assign(
    {},
    ...apiFiles.map((file) => {
      let filePath = file;
      if (false === file.includes(distDir)) {
        filePath = filePath.replace('src', distDir);
      }
      const impl = require(filePath).default;
      return { [impl.name]: impl };
    }),
  );

  if (process.env.NODE_ENV === 'development') {
    options.logger.info('Adding handler for client builder');
    const buildImpl = (context: ResiContext) => {
      // const context = getContext();
      if (context.writeStream) {
        const { writeStream } = context;
        buildClientFileCommands(resiAPIImplementation, apiFiles, distDir, modelFiles, (createFileMessage) =>
          writeStream(JSON.stringify(createFileMessage)),
        );
      } else throw new Error('No writeStream in Context!');
    };
    const build: ResiHandler = enrich<typeof buildImpl>(buildImpl, streamResponse);
    resiAPIImplementation[BUILD_CLIENT_API] = {
      build,
      name: BUILD_CLIENT_API,
    };
  }

  return await createServer(resiAPIImplementation, options);
}

/**
 * @returns {import('./mapAPIToRouter').Context}
 */
export function getContext(a = arguments) {
  const args = getContext.caller.arguments;
  return args[args.length - 1];
}
