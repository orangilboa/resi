import { Handler } from 'express';
import { PlugsMap } from './clientBuildCommon';

export type PlugFunction<T> = (target: T) => T;

export const PLUGS = {
  streamResponse: '__stream_response',
  withAuthorization: '__with_autorization',
  httpGet: '__http_get',
  prependMiddleware: '__prepend_middleware',
  appendMiddleware: '__append_middleware',
  customRequestBody: '__custom_request_body',
  customHeaders: '__custom_headers',
  roleAuthorization: '__role_authorization'
};

const plugFields = Object.values(PLUGS);

export const addCustomPlug = (plugName: keyof typeof PLUGS, plugField = plugName) => {
  PLUGS[plugName] = plugField;
  plugFields.push(plugField);
};

export const checkPlug = (target: any, plug: string) => target[plug];

function defaultPlugAction<T>(target: T, plugName: string) {
  (target as any)[plugName] = true;
  return target;
}

const makeDefaultPlugAction = (plugName: string) => {
  const func = <T>(target: T) => defaultPlugAction(target, plugName);
  return func;
};

export function enrich<T>(func: T, ...plugs: PlugFunction<T>[]) {
  plugs.forEach((plug) => plug(func));
  return func;
}

export function readPlugs(func: any) {
  const plugs: { [plug: string]: boolean } = {};
  plugFields.forEach((pf) => {
    if (func[pf]) {
      plugs[pf] = func[pf];
    }
  });
  return plugs;
}

export function applyPlugs(api: any, plugsMap: PlugsMap) {
  Object.keys(plugsMap).forEach((key) => {
    const func = api[key];
    if (!func) return;
    Object.assign(func, plugsMap[key]);
  });
}

export const streamResponse = makeDefaultPlugAction(PLUGS.streamResponse);
export const authorization = makeDefaultPlugAction(PLUGS.withAuthorization);
export const httpGet = makeDefaultPlugAction(PLUGS.httpGet);
export const customRequestBody = makeDefaultPlugAction(PLUGS.customRequestBody);
export const prependMiddleware = (...handlers: Handler[]) => (target: any) => {
  defaultPlugAction(target, PLUGS.prependMiddleware);
  target.__prepend_middleware_handlers = handlers;
};
export const appendMiddleware = (...handlers: Handler[]) => (target: any) => {
  defaultPlugAction(target, PLUGS.appendMiddleware);
  target.__append_middleware_handlers = handlers;
};
export const customHeader = (headersObj: object) => (target: any) => {
  target[PLUGS.customHeaders] = headersObj;
}
export const roleAuthorization = (...roles: number[]) => (target: any) => {
  if (!checkPlug(target, PLUGS.withAuthorization)) {
    authorization(target);
  }

  defaultPlugAction(target, PLUGS.roleAuthorization);
  target.__authorized_roles = roles;
}
