import { Client, PrivateKey } from 'dsteem';

const CHAIN_ID = 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c';
const ADDRESS_PREFIX = 'BLT';

// Read-only RPC nodes (for get_dynamic_global_properties, get_accounts)
const RPC_NODES = [
  'https://rpc.blurt.world',
  'https://api.blurtnode.com',
  'https://blurt.enki.com.tr',
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Get working dsteem Client — tries each node
async function getWorkingClient() {
  for (const node of RPC_NODES) {
    try {
      console.log(`[CLIENT] Trying node: ${node}`);
      const client = new Client(node, {
        chainId: CHAIN_ID,
        addressPrefix: ADDRESS_PREFIX,
        timeout: 15000,
      });
      // Quick connectivity test
      await client.database.getDynamicGlobalProperties();
      console.log(`[CLIENT] ✅ Connected: ${node}`);
      return client;
    } catch (err) {
      console.log(`[CLIENT] ❌ Failed: ${node} — ${err.message}`);
    }
  }
  throw new Error('No working Blurt RPC node found');
}

// ── Get Account ──────────────────────────────────────────────────────────────
export async function getAccount(username) {
  try {
    const client = await getWorkingClient();
    const accounts = await client.database.getAccounts([username]);
    if (!accounts || accounts.length === 0) return null;
    console.log(`[ACCOUNT] ✅ Found: @${username}`);
    return accounts[0];
  } catch (err) {
    console.error('[ACCOUNT] Error:', err.message);
    return null;
  }
}

// ── Publish Post ─────────────────────────────────────────────────────────────
export async function publishPost({ author, title, body, tags, postingKey }) {
  // 1. Permlink — collision-proof
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  const permlink = `${slug}-${Date.now()}`;
  console.log(`[POST] author: @${author} | permlink: ${permlink}`);

  // 2. Tags — validated
  const tagList = (tags || 'blurt')
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
    .filter(t => t.length > 0)
    .slice(0, 5);
  if (tagList.length === 0) tagList.push('blurt');
  console.log(`[POST] tags: ${tagList.join(', ')}`);

  // 3. Metadata
  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  // 4. Get working client
  const client = await getWorkingClient();
  const key = PrivateKey.fromString(postingKey);

  // 5. Build comment operation
  const commentOp = {
    parent_author: '',
    parent_permlink: tagList[0],
    author,
    permlink,
    title,
    body,
    json_metadata,
  };

  console.log('[TX] Building and signing transaction via dsteem...');

  // 6. Broadcast with retry — dsteem handles serialization + signing internally
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[BROADCAST] Attempt ${attempt}/3...`);

      const result = await client.broadcast.comment(commentOp, key);

      console.log(`[BROADCAST] ✅ SUCCESS!`);
      console.log(`[BROADCAST] tx_id: ${result?.id}`);
      console.log(`[BROADCAST] block: ${result?.block_num}`);

      return { permlink, result };

    } catch (err) {
      console.log(`[BROADCAST] ❌ Attempt ${attempt} failed: ${err.message}`);
      lastError = err;

      if (attempt < 3) {
        const waitMs = 2000 * attempt;
        console.log(`[BROADCAST] Waiting ${waitMs}ms before retry...`);
        await sleep(waitMs);

        // Re-init client on retry in case node went down
        try {
          const freshClient = await getWorkingClient();
          Object.assign(client, freshClient);
        } catch (e) {
          console.log('[BROADCAST] Could not get fresh client:', e.message);
        }
      }
    }
  }

  throw new Error(`Broadcast failed after 3 attempts: ${lastError?.message}`);
}