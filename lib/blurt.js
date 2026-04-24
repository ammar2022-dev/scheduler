import { Client, PrivateKey } from 'dsteem';

const CHAIN_ID = 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c';
const ADDRESS_PREFIX = 'BLT';

const RPC_NODES = [
  'https://rpc.blurtlatam.com',
  'https://api.blurt.blog',
  'https://api.moecki.online',
  'https://blurt-rpc.saboin.com',
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWorkingClient() {
  for (const node of RPC_NODES) {
    for (let attempt = 1; attempt <= 3; attempt++) {
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
        if (attempt < 3) await sleep(1000 * attempt);
      }
    }
  }
  throw new Error('All RPC nodes failed — cannot connect to Blurt');
}

export async function getAccount(username) {
  try {
    const client = await getWorkingClient();
    const accounts = await client.database.getAccounts([username]);
    if (!accounts || accounts.length === 0) {
      console.log(`[ACCOUNT] Not found: @${username}`);
      return null;
    }
    console.log(`[ACCOUNT] ✅ Found: @${username}`);
    return accounts[0];
  } catch (err) {
    console.error('[ACCOUNT] Error:', err.message);
    return null;
  }
}

export async function publishPost({ author, title, body, tags, postingKey }) {
  // 1. Permlink
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  const permlink = `${slug}-${Date.now()}`;
  console.log(`[POST] permlink: ${permlink}`);

  // 2. Tags
  const tagList = (tags || 'blurt')
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
    .filter(t => t.length > 0)
    .slice(0, 5);
  if (!tagList.length) tagList.push('blurt');
  console.log(`[POST] tags: ${tagList.join(', ')}`);

  // 3. Metadata
  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  // 4. Comment operation
  const commentOp = {
    parent_author: '',
    parent_permlink: tagList[0],
    author,
    permlink,
    title,
    body,
    json_metadata,
  };

  // 5. Broadcast with retry
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[BROADCAST] Attempt ${attempt}/3`);
      const client = await getWorkingClient();
      const key = PrivateKey.fromString(postingKey);
      const result = await client.broadcast.comment(commentOp, key);
      console.log(`[BROADCAST] ✅ SUCCESS | tx: ${result?.id} | block: ${result?.block_num}`);
      return { permlink, result };
    } catch (err) {
      console.log(`[BROADCAST] ❌ Attempt ${attempt} failed: ${err.message}`);
      lastError = err;
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }

  throw new Error(`Broadcast failed after 3 attempts: ${lastError?.message}`);
}