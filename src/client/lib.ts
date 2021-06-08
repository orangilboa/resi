export const TOKEN_KEY = '@resi-token';
import { AUTH_TOKEN_FIELD } from '../common/typesConsts';

const getAsyncStorage = () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage;
  } catch (e) {
    console.log('RESI: No Local Storage');
    return null;
  }
};

export function getToken(data: any) {
  const token = data && data[AUTH_TOKEN_FIELD];
  return token;
}

export async function executeFetchReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callback: (value: Uint8Array) => void,
): Promise<void> {
  const { done, value } = await reader.read();
  if (value) callback(value);
  if (done) {
    return;
  } else return executeFetchReader(reader, callback);
}

export const aS = getAsyncStorage();
