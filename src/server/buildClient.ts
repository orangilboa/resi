import fs from 'fs';
import path from 'path';
import { Parser } from 'acorn';

// import { MODELS_DIRECTORY } from '../utils';
import { CreateFileMessage, PlugsMap } from '../common/clientBuildCommon';
import { readPlugs } from '../common/plugs';
import { ResiAPIImplementation, ResiHandler } from '../common/typesConsts';

export function buildClientFileCommands(
  resiAPIImplementation: ResiAPIImplementation,
  apiFiles: string[],
  distDir: string,
  modelFiles: string[],
  callback: (buf: CreateFileMessage) => void,
) {
  apiFiles.forEach((apiFile) => {
    const content = buildAPIFile(resiAPIImplementation, apiFile, distDir);
    if (content) callback(content);
  });

  modelFiles.forEach((modelFile) =>
    callback(new CreateFileMessage(path.basename(modelFile), fs.readFileSync(modelFile).toString(), 'models')),
  );

  return {};
}

function buildAPIFile(resiAPIImplementation: ResiAPIImplementation, apiFile: string, distDir: string) {
  let filePath = apiFile;
  if (false === apiFile.includes(distDir)) {
    filePath = filePath.replace('src', distDir);
  }
  const fileImpl = require(filePath).default;
  const impl = resiAPIImplementation[fileImpl.name];

  let content = fs.readFileSync(apiFile).toString();
  content = stripImports(content);

  const parse: acorn.Node & { body: any[] } = Parser.parse(content, { sourceType: 'module' }) as acorn.Node & {
    body: any[];
  };

  let properties: any[] = [];
  const objNode = parse.body.find((n) => {
    if (!n.declaration || !n.declaration.callee || n.declaration.callee.name !== 'createAPIImplementation')
      return false;

    properties = n.declaration.arguments[1].properties;
    return true;
  });

  if (!objNode || !properties) return null;

  const replacements = [];
  const plugsMap: PlugsMap = {};

  // properties.forEach(n => {
  for (let i = 0; i < properties.length; i++) {
    const n = properties[i];
    const funcImpl = impl[n.key.name];
    if (funcImpl instanceof Function) {
      const functionBody = content.substring(n.start, n.end);
      replacements.push({ functionBody, name: n.key.name, funcImpl: funcImpl as ResiHandler });
      const plugs = readPlugs(impl[n.key.name]);
      plugsMap[n.key.name] = plugs;
    }
  }

  replacements.forEach(({ functionBody, name, funcImpl }) => {
    const params = funcImpl.__params || [];
    content = content.replace(functionBody, `${name}(${params.join(', ')}){}`);
  });

  return new CreateFileMessage(path.basename(apiFile), content, 'APIs', plugsMap, impl.name);
}

function stripImports(content: string) {
  const stripped = content
    .split('\n')
    .filter((row) => {
      const keep =
        false === (row.includes('require') || row.includes('import')) ||
        row.includes('models') ||
        (row.includes('@horos/resi') && false === row.includes('server'));
      if (!keep) {
        console.log('Stripping', { row });
      }
      return keep;
    })
    .join('\n');
  return stripped;
}
