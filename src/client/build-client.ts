#!/usr/bin/env node

import axios from 'axios';
import path from 'path';
import { promises as fs } from 'fs';
import { defaultOptions } from '.';
import { MODELS_DIRECTORY, API_DIRECTORY } from '../common/typesConsts';
import { BUILD_CLIENT_FUNCTION, BUILD_CLIENT_API, CreateFileMessage } from '../common/clientBuildCommon';
import { describeAPI } from '../common/utils';

type APIFile = { file: string; apiName: string };

export async function buildClient(url: string, resiDir: string) {
  await fs.mkdir(resiDir, { recursive: true });
  const requestUrl = [url, BUILD_CLIENT_API, BUILD_CLIENT_FUNCTION].join('/');
  const modelsDir = path.join(resiDir, MODELS_DIRECTORY);
  const apisDir = path.join(resiDir, API_DIRECTORY);
  const [res] = await Promise.all([
    axios.post(requestUrl, {}, { responseType: 'stream' }),
    fs.rmdir(modelsDir, { recursive: true }),
    fs.rmdir(apisDir, { recursive: true }),
  ]);

  await Promise.all([fs.mkdir(modelsDir), fs.mkdir(apisDir)]);

  const createFilePromises: Promise<void>[] = [];
  const apis: APIFile[] = [];
  return defaultOptions
    .streamHandler(res, (cfm: Buffer) => {
      const parsed = JSON.parse(cfm.toString());
      createFilePromises.push(handleCreateFileMessage(modelsDir, apisDir, parsed, apis));
    })
    .then(() => {
      const indexFileContent = createAPIIndexFileContent(apis);
      console.log('indexFileContent', indexFileContent);
      return Promise.all([fs.writeFile(path.join(apisDir, 'index.js'), indexFileContent), ...createFilePromises]);
    })
    .then(() => {
      console.log('All files written');
      // testSuccess(apisDir);
    })
    .catch((e) => console.error('Failed!', e));
}

function testSuccess(apisDir: string) {
  const resiFilePath = path.resolve(path.join(apisDir, 'index.js'));
  console.log('Main API File Path', resiFilePath);
  const resiAPI = require(resiFilePath);
  if (resiAPI.resiAPIImplementation && resiAPI.makeResiClient) {
    console.log('Test succeeded');
    console.log(describeAPI(resiAPI.resiAPIImplementation));
  }
}

function createAPIIndexFileContent(apis: APIFile[]) {
  const imports: string[] = [];
  const applyPlugs: string[] = [];
  const objectFields: string[] = [];

  apis.forEach(({ apiName, file }) => {
    imports.push(`import ${apiName}, { plugsMap as ${apiName}_plugs } from './${path.basename(file)}';`);
    applyPlugs.push(`applyPlugs(${apiName}, ${apiName}_plugs);`);
    objectFields.push(`${apiName}`);
  });

  return `import { makeResiImplementationFactory } from '@horos/resi/client';
  import { applyPlugs } from '@horos/resi/plugs';

  // Importing all APIs
  ${imports.join('\n')}
  
  // Applying plugs to functions
  ${applyPlugs.join('\n')}

  // Actual API Object
  export const resiAPIImplementation = {
    ${objectFields.join(',\n')}
  };
  
  // Helper function for creating a client with intellisense
  export const makeResiClient = makeResiImplementationFactory(resiAPIImplementation)`;
}

async function handleCreateFileMessage(
  modelsDir: string,
  apisDir: string,
  createFileMessage: CreateFileMessage,
  apis: APIFile[],
) {
  const filePath = path.join(createFileMessage.dir === 'APIs' ? apisDir : modelsDir, createFileMessage.filePath);
  console.log('Creating file at', { filePath });
  if (createFileMessage.plugsMap) {
    createFileMessage.fileContent += `

export const plugsMap=JSON.parse('${JSON.stringify(createFileMessage.plugsMap)}');`;
  }

  if (createFileMessage.apiName) {
    apis.push({ file: filePath, apiName: createFileMessage.apiName });
  }

  await fs.writeFile(filePath, createFileMessage.fileContent);
}

let [URL, RESI_DIR] = process.argv.slice(process.argv.length - 2);
if (URL && RESI_DIR) {
  if (!URL.includes('resi')) URL += '/resi';

  console.log('Building RESI client', { url: URL, resiDir: RESI_DIR });

  buildClient(URL, './src/resi-client')
    .then(() => console.log('RESI client build succeeded'))
    .catch((error) => console.error('RESI client build failed', { error }));
}
