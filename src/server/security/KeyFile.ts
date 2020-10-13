import { promises as fs } from 'fs';

export class KeyFile {
  constructor(path: string, content?: string | Buffer) {
    this.path = path;
    this.content = content;
  }

  path: string;
  content?: string | Buffer;

  async loadContent() {
    const buffer = await fs.readFile(this.path);
    this.content = buffer;
  }

  static async loadFromPath(path: string) {
    const keyFile = new KeyFile(path);
    await keyFile.loadContent();
    return keyFile;
  }

  /**
   * @template T
   * @param {T & {[name:string]: string}} keyFiles
   * @returns {{[name in keyof(T)]: KeyFile}}
   */
  static async resolveKeyFiles(keyFilePaths: { [name: string]: string }) {
    const keyFiles: { [key: string]: string | Buffer | undefined } = {};
    await Promise.all(
      Object.entries(keyFilePaths).map(([key, path]) => {
        return (async () => {
          const keyFile = await KeyFile.loadFromPath(path);
          keyFiles[key] = keyFile.content;
        })();
      }),
    );

    return keyFiles;
  }
}
