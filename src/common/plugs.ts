import { PlugsMap } from './clientBuildCommon';

export type PlugFunction<T> = (target: T) => T;

export const PLUGS = {
  streamResponse: '__stream_response',
  withAuthorization: '__with_autorization',
};

const plugFields = Object.values(PLUGS);

export const addCustomPlug = (plugName: keyof typeof PLUGS, plugField = plugName) => {
  PLUGS[plugName] = plugField;
  plugFields.push(plugField);
};

export const checkPlug = (target: any, plug: string) => target[plug] && target[plug] === true;

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
