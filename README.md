# Resi Web API Platform
This is still in testing

This platform allows you to implement your API on the server side,
and generate a client side with built in intellisense support.

The package ships with PASETO token management, and support for streaming responses from the server.

## Installation
`npm i -s @horos/resi` or 
`yarn add @horos/resi`

## Server side usage
1. Create 2 folders, one for your api files (the actual functions) and one for your models.
2. Create a model file

```javascript
export class TestModel{
    /**
     * 
     * @param {string} a 
     */
    constructor (a) {
        this.a = a;
    }
}
```

3. Create an API file


```javascript
import { TestModel } from '../models/testModel';
import { enrich, authorization } from '@horos/resi/plugs';
import { createAPIImplementation } from '@horos/resi/create-api';

//                                       ⬇ API name
export default createAPIImplementation('test', {
  /**
   * This JSDoc will be kept for intellisense on the client side
   * 
   * @param {number} num1
   * @param {number} num2
   * @returns {Promise<number>}
   */
  test(num1, num2) {
    return num1 + num2;
  },

  /**
   * @returns {Promise<import('../models/testModel').TestModel>}
   */

//         ⬇ Use the enrich function to plug features to your funtion
  shogi: enrich(async function () {
    return new TestModel('banana');
    // ⬇ In this case authorization is plugged, which means only authorized clients can invoke this handler
  }, authorization),
});
```

3. Security object is needed for authorizing incoming requests. 3 Keys are required in total - Public/Private key pair, and a secret key.

You can generate them like this by adding this command to your package.json scripts:

`"generate-security-keys": "create-key-set ./security-keys"`

Load your keys before you initialize the server

```javascript
import { KeyFile } from '@horos/resi/server';

const keyFilePaths = {
  publicKey: './security-keys/public',
  privateKey: './security-keys/private',
  secret: './security-keys/secret',
};

/**
 * @type {{[key in keyof(keyFilePaths)]: KeyFile}}
 */
let keyFiles;

export async function loadKeyFiles() {
    if (!keyFiles) keyFiles = await KeyFile.resolveKeyFiles(keyFilePaths);
    
  return keyFiles;
}
```

4. Finally create your RESI API using your API and models directories, and your security files

```javascript  
import { createServerFromResiDir } from '@horos/resi/server';

async function init(){
    await createServerFromResiDir(
        path.resolve('./src/resi-server/apis'),
        path.resolve('./src/resi-server/models'),
        {
            security,
        }
    );
}
```

## Client side usage
1. Install @horos/resi on your client as well
2. Make sure the server is running with NODE_ENV set to "development"
3. Add a script to your package.json
`"build-client": "build-client http://localhost src/resi-client"`
Replace the "http://localhost" with the url of your server, and "src/resi-client" with any path you wish
4. Execute the new script. This should create a local API, identical to the one on your server
5. Test your client
```javascript
import { makeResiClient } from './resi-client/apis';

export const resi = makeResiClient('http://localhost');
```

Type "resi." and you should see intellisense auto compeleting according to your server definition.

Execute any function, and it should invoke its equivalent on the server.