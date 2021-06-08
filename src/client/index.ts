import { checkPlug, PLUGS } from '../common/plugs';
import { AUTH_TOKEN_FIELD, ResiAPIImplementation, ResiClient, RESI_ROUTE } from '../common/typesConsts';
import { aS, executeFetchReader, getToken, TOKEN_KEY } from './lib';

export const defaultOptions = {
  fetchOptions: {},
  errorHandler(error: object | string) {
    console.error(error);
    return undefined;
  },
  async responseHandler(res: Response) {
    const data = await res.json();
    const token = getToken(data);
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
    return data;
  },
  async streamHandler(res: Response, callback: (buf: Uint8Array) => void) {
    console.log('stream handler res', res);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Unable to open download stream');
    else return executeFetchReader(reader, callback);
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
    return this.__init_header_not_first();
  },
  async __init_header_not_first() {
    return {
      'Content-Type': 'application/json',
    };
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
      const funcName = func.toString();
      const funcMetadata = apiImpl[funcName];
      const fetchConfig: RequestInit = Object.assign({}, options.fetchOptions);
      const isStream = checkPlug(funcMetadata, PLUGS.streamResponse);

      apiImpl[funcName] = async function (...args: any[]) {
        fetchConfig.headers = await options.__init_header();

        if (checkPlug(funcMetadata, PLUGS.withAuthorization) || checkPlug(apiImpl, PLUGS.withAuthorization)) {
          if (options.__token) {
            fetchConfig.headers.Authorization = options.__token;
          } else console.error('Log in first');
        }

        const customHeaders = checkPlug(funcMetadata, PLUGS.customHeaders);
        if (customHeaders) {
          Object.assign(fetchConfig.headers, customHeaders);
        }

        const isCustomBody = checkPlug(funcMetadata, PLUGS.customRequestBody);
        const requestBody = isCustomBody ? args[0] : { args: isStream ? args.slice(0, args.length - 1) : args };

        try {
          const url = [URL, RESI_ROUTE, apiName, funcName].join('/');
          const res = await fetch(url, { method: 'POST', body: JSON.stringify(requestBody), ...fetchConfig });
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
        await aS.removeItem(TOKEN_KEY);
      }
    },
  };
  return clientImpl;
}

export function makeResiImplementationFactory<T>(resiAPIImplementation: T) {
  return (URL: string, options = defaultOptions) =>
    (makeClient((resiAPIImplementation as unknown) as ResiAPIImplementation, URL, options) as unknown) as ResiClient<T>;
}
