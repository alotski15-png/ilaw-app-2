
import { createClient } from 'redis';
import crypto from 'crypto';

const TOKEN_PREFIX = 'epk_';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisClient;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) return redisClient;
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', (err) => {
    // don't crash, but surface logs
    console.error('Redis client error', err);
  });
  await redisClient.connect();
  return redisClient;
}

function makeToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(12).toString('hex')}`;
}

export async function setEphemeralKeys(keys = {}, ttlSeconds = 600) {
  const token = makeToken();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const client = await getRedisClient();
  await client.set(token, JSON.stringify(keys), { EX: ttlSeconds });
  return { token, expiresAt };
}

export async function getEphemeralKeys(token) {
  if (!token) return null;
  const client = await getRedisClient();
  const raw = await client.get(token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

