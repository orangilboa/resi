import { enrich, PlugFunction } from "./plugs";
import { ResiAPIImplementation } from "./typesConsts";

export function createAPIImplementation<T extends {}>(
    name: string,
    apiImplementation: T,
    ...plugs: PlugFunction<ResiAPIImplementation>[]
  ) {
    // Object.keys(apiImplementation).forEach((key) => {
    //   const val = apiImplementation[key];
    //   if (val instanceof Function) {
    //     apiImplementation[key] = function marker(...args: any[]) {
    //       return val(...args);
    //     };
    //   }
    // });
    const editable = apiImplementation as any;
    editable.name = name;
    enrich(editable, ...plugs);
    return editable as T;
  }
  
  export function createHandler<T>(func: T, ...plugs: PlugFunction<T>[]) {
    if (plugs.length > 0) enrich(func, ...plugs);
    return func;
  }