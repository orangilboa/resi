import { APIImplementation } from './typesConsts';

const STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/gm;
const ARGUMENT_NAMES = /([^\s,]+)/g;

const exclude = [
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
  'toLocaleString',
  'function',
  'name',
];

export function getParamNames(func: Function, isTS = false) {
  const fnStr = func.toString().replace(STRIP_COMMENTS, '').replace(':', ': ');
  let result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if (result === null) result = [];
  result = result.filter((i) => i !== 'context');
  return isTS ? result.filter((f) => f.endsWith(':')).map((f) => f.substring(0, f.length - 1)) : result;
}

export function* iterateFunctionsAndParams(API: APIImplementation) {
  const functions = Object.keys(API).filter(
    (func) => false === func.toString().startsWith('_') && !exclude.find((i) => func.includes(i)),
  );
  for (const func of functions) {
    const funcImpl = API[func];
    if (funcImpl instanceof Function) {
      const params = getParamNames(funcImpl);
      yield { func, params };
    }
  }
}
