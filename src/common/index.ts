/**
 * @typedef {{[api:string]: {[func:string]: (...args:any[]) => Promise}}} APIDefinition
 * @typedef {{[api:string]: {[func:string]: (...args:any[], req:import('express').Request) => Promise}}} APIImplementation
 */

import { ResiModel } from './resiModel';

export { ResiModel };
