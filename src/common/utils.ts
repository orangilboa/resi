import { AxiosResponse } from 'axios';
import { AUTH_TOKEN_FIELD, ResiAPIImplementation } from './typesConsts';

export function mergeOptions<T, TMerged=T>(options: T, defaultOptions: T) {
  const finalOptions: any = !options
    ? defaultOptions
    : options === defaultOptions
    ? options
    : Object.assign({}, defaultOptions, options);
  Object.keys(finalOptions).forEach((key) => {
    if (finalOptions[key] instanceof Function) {
      finalOptions[key] = finalOptions[key].bind(finalOptions);
    }
  });
  return finalOptions as TMerged;
}

export function getToken(res: AxiosResponse) {
  const token = res.data && res.data[AUTH_TOKEN_FIELD];
  return token;
}

export function describeAPI(resiAPIImplementation: ResiAPIImplementation, tabPadding = '') {
  const lines: string[] = [];

  Object.keys(resiAPIImplementation).forEach((api) => {
    lines.push(`${tabPadding} ${api}`);
    Object.keys(resiAPIImplementation[api]).forEach((func) => {
      if (func === 'name') return;
      lines.push(`${tabPadding}     ${func}`);
    });
  });
  return lines.join('\n');
}