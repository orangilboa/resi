export type PlugsMap = { [func: string]: { [plug: string]: boolean } };

export class CreateFileMessage {
  
  constructor(filePath: string, fileContent: string | Buffer, dir: "models" | "APIs", plugsMap?: PlugsMap, apiName?: string) {
    this.filePath = filePath;
    this.fileContent = fileContent;
    this.dir = dir;
    this.plugsMap = plugsMap;
    this.apiName = apiName;
  }
  filePath: string;
  fileContent: string | Buffer;
  dir: string;
  plugsMap?: PlugsMap;
  apiName?: string;
}

export const BUILD_CLIENT_API = 'clientBuilder';
export const BUILD_CLIENT_FUNCTION = 'build';
