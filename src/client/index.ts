import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getParamNames } from '../common/functionParsing';
import { checkPlug, PLUGS } from '../common/plugs';
import { ResiAPIImplementation, ResiClient, ResiHandler, RESI_ROUTE } from '../common/typesConsts';
import { getToken } from '../common/utils';

const TOKEN_KEY = '@resi-token';

const getAsyncStorage = () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage;
  } catch (e) {
    console.log('RESI: No Storage', e);
    return null;
  }
};

const aS = getAsyncStorage();

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

      if (this.__last_token !== this.__token) {
        if (aS) {
          aS.setItem(TOKEN_KEY, this.__token)
            .then(() => console.log('RESI: Token stored'))
            .catch((e: Error) => console.error('Failed to store token', { e }));
        }
        this.__last_token = this.__token;
      }
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
  __last_token: '',
  async __init_header_first() {
    if (aS) {
      const item = await aS.getItem(TOKEN_KEY);
      if (item) {
        console.log('RESI: Found token', { item });
        this.__token = item;
      } else {
        console.log('RESI: No token');
      }
    }
    return {};
  },
  async __init_header_not_first() {
    return {};
  },
  async __init_header() {
    const res = await this.__init_header_first();
    this.__init_header = this.__init_header_not_first;
    return res;
  },
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
        axiosConfig.headers = await options.__init_header();

        if (checkPlug(funcMetadata, PLUGS.withAuthorization) || checkPlug(apiImpl, PLUGS.withAuthorization)) {
          if (options.__token) {
            axiosConfig.headers.Authorization = options.__token;
          } else console.error('Log in first');
        }

        const customHeaders = checkPlug(funcMetadata, PLUGS.customHeaders);
        if (customHeaders) {
          Object.assign(axiosConfig.headers, customHeaders);
        }

        const requestBody = checkPlug(funcMetadata, PLUGS.customRequestBody) ? args[0] : { args };
        try {
          const url = [URL, RESI_ROUTE, apiName, funcName].join('/');
          const res = await axios.post(url, requestBody, axiosConfig);
          return isStream ? options.streamHandler(res, args[args.length - 1]) : options.responseHandler(res);
        } catch (error) {
          return options.errorHandler(error);
        }
      };
    }
  }

  const clientImpl = resiAPIImplementation as ResiClient<ResiAPIImplementation>;
  clientImpl.resi = {
     clearCredentials: async () => {
      options.__token = '';
      options.__last_token = '';

      if (aS) {
        await aS.removeItem(TOKEN_KEY)
      }
    },
  };
  return clientImpl;
}

export function makeResiImplementationFactory<T>(resiAPIImplementation: T) {
  return (URL: string, options = defaultOptions) =>
    (makeClient((resiAPIImplementation as unknown) as ResiAPIImplementation, URL, options) as unknown) as ResiClient<T>;
}
