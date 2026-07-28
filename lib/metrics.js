import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let _client;

async function getClient() {
  if (_client && _client.isOpen) return _client;
  _client = createClient({ url: REDIS_URL });
  _client.on('error', (err) => console.error('Redis metrics client error', err));
  await _client.connect();
  return _client;
}

export async function incrementMetric(key, by = 1) {
  try {
    const client = await getClient();
    return client.incrBy(`metrics:${key}`, by);
  } catch (e) {
    console.error('Failed to increment metric', key, e);
    return null;
  }
}

export async function getMetric(key) {
  try {
    const client = await getClient();
    const v = await client.get(`metrics:${key}`);
    return v ? parseInt(v, 10) : 0;
  } catch (e) {
    console.error('Failed to read metric', key, e);
    return null;
  }
}

export async function getAllMetrics() {
  try {
    const client = await getClient();
    const keys = await client.keys('metrics:*');
    const out = {};
    for (const k of keys) {
      const short = k.replace(/^metrics:/, '');
      out[short] = parseInt((await client.get(k)) || '0', 10);
    }
    return out;
  } catch (e) {
    console.error('Failed to list metrics', e);
    return {};
  }
}
