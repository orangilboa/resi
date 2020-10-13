import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getParamNames } from '../common/functionParsing';
import { checkPlug, PLUGS } from '../common/plugs';
import { ResiAPIImplementation, ResiHandler, RESI_ROUTE } from '../common/typesConsts';
import { getToken } from '../common/utils';

export const defaultOptions = {
  axiosConfig: {},
  errorHandler(error: object | string) {
    console.error(error);
    return undefined;
  },
  responseHandler(res: AxiosResponse) {
    const token = getToken(res);
    if (token) {
      this.__token = `Bearer ${token}`;
    }
    return res.data;
  },
  streamHandler(res: AxiosResponse, callback: (buf: Buffer) => void) {
    return new Promise((resolve, reject) => {
      res.data.on('data', callback);
      res.data.on('end', resolve);
      res.data.on('error', reject);
    });
  },
  __token: '',
};

export function makeClient(resiAPIImplementation: ResiAPIImplementation, URL: string, options = defaultOptions) {
  for (const apiName in resiAPIImplementation) {
    const apiImpl = resiAPIImplementation[apiName];
    for (const func in apiImpl) {
      if (false === apiImpl[func] instanceof Function) continue;
      const params = getParamNames(apiImpl[func] as ResiHandler);
      const funcName = func.toString();
      const funcMetadata = apiImpl[funcName];
      const axiosConfig: AxiosRequestConfig = Object.assign({}, options.axiosConfig);
      const isStream = checkPlug(funcMetadata, PLUGS.streamResponse);
      if (isStream) {
        axiosConfig.responseType = 'stream';
      }

      apiImpl[funcName] = async function (...args: any[]) {
        if (checkPlug(funcMetadata, PLUGS.withAuthorization) || checkPlug(apiImpl, PLUGS.withAuthorization)) {
          // axiosConfig.headers.AUTHORIZATION =
          if (options.__token) {
            axiosConfig.headers = { Authorization: options.__token };
          } else console.error('Log in first');
        }
        console.log('params', params);
        // const requestBody = Object.assign(
        //   {},
        //   ...args.map((arg, idx) => ({ [params[idx]]: arg }))
        // );

        const requestBody = { args };
        try {
          const url = [URL, RESI_ROUTE, apiName, funcName].join('/');
          console.log('HTTP REQUEST', { url, requestBody });
          const res = await axios.post(url, requestBody, axiosConfig);
          return isStream ? options.streamHandler(res, args[args.length - 1]) : options.responseHandler(res);
        } catch (error) {
          return options.errorHandler(error);
        }
      };
    }
  }
  return resiAPIImplementation;
}

export function makeResiImplementationFactory<T>(resiAPIImplementation: T) {
  return (URL: string, options = defaultOptions) =>
    (makeClient((resiAPIImplementation as unknown) as ResiAPIImplementation, URL, options) as unknown) as T;
}
