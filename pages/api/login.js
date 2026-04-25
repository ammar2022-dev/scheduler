import { Client, PrivateKey } from 'dsteem';

const CHAIN_ID = 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c';
const ADDRESS_PREFIX = 'BLT';

const RPC_NODES = [
  'https://api.moecki.online',
  'https://blurt-rpc.saboin.com',
  'https://rpc.blurtlatam.com',
  'https://api.blurt.blog',
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function httpRpc(node, method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    console.log(`[RPC] ${node} | ${method} | status:${res.status} | ${text.slice(0, 150)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function getAccount(username) {
  for (const node of RPC_NODES) {
    try {
      console.log(`[ACCOUNT] Trying ${node} for @${username}`);
      const result = await httpRpc(node, 'condenser_api.get_accounts', [[username]]);
      console.log(`[ACCOUNT] isArray:${Array.isArray(result)} length:${result?.length}`);
      if (result && Array.isArray(result) && result.length > 0) {
        console.log(`[ACCOUNT] ✅ Found @${username} on ${node}`);
        return result[0];
      }
      console.log(`[ACCOUNT] Empty result from ${node}`);
    } catch (err) {
      console.log(`[ACCOUNT] ❌ ${node}: ${err.message}`);
    }
  }
  console.error(`[ACCOUNT] All nodes failed for @${username}`);
  return null;
}

async function getWorkingClient() {
  for (const node of RPC_NODES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[CLIENT] Trying: ${node} (attempt ${attempt})`);
        const client = new Client(node, {
          chainId: CHAIN_ID,
          addressPrefix: ADDRESS_PREFIX,
          timeout: 15000,
        });
        await client.database.getDynamicGlobalProperties();
        console.log(`[CLIENT] ✅ Connected: ${node}`);
        return client;
      } catch (err) {
        console.log(`[CLIENT] ❌ ${node} attempt ${attempt}: ${err.message}`);
        if (attempt < 2) await sleep(1000);
      }
    }
  }
  throw new Error('All RPC nodes failed');
}

export async function publishPost({ author, title, body, tags, postingKey }) {
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  const permlink = `${slug}-${Date.now()}`;
  console.log(`[POST] author:@${author} permlink:${permlink}`);

  const tagList = (tags || 'blurt')
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
    .filter(t => t.length > 0)
    .slice(0, 5);
  if (!tagList.length) tagList.push('blurt');
  console.log(`[POST] tags: ${tagList.join(', ')}`);

  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  const commentOp = {
    parent_author: '',
    parent_permlink: tagList[0],
    author,
    permlink,
    title,
    body,
    json_metadata,
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[BROADCAST] Attempt ${attempt}/3`);
      const client = await getWorkingClient();
      const key = PrivateKey.fromString(postingKey);
      const result = await client.broadcast.comment(commentOp, key);
      console.log(`[BROADCAST] ✅ SUCCESS | tx:${result?.id} | block:${result?.block_num}`);
      return { permlink, result };
    } catch (err) {
      console.log(`[BROADCAST] ❌ Attempt ${attempt}: ${err.message}`);
      lastError = err;
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  throw new Error(`Broadcast failed: ${lastError?.message}`);
}