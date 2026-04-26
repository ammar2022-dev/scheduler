const { Client, PrivateKey } = require('@beblurt/dblurt');
const getSlug = require('speakingurl');

const RPC_NODES = [
  'https://rpc.blurt.blog',
  'https://rpc.beblurt.com',
  'https://rpc.blurt.world',
  'https://blurt-rpc.saboin.com',
];

function getClient() {
  return new Client(RPC_NODES, { timeout: 15000 });
}

// Exact same logic as steemit/blurt condenser TransactionSaga.js
function sanitizePermlink(permlink) {
  if (permlink.length > 255) {
    permlink = permlink.substring(permlink.length - 255, permlink.length);
  }
  // only letters, numbers, and dashes shall survive (condenser's exact comment)
  permlink = permlink.toLowerCase().replace(/[^a-z0-9-]+/g, '');
  return permlink;
}

async function generatePermlink(title, author) {
  // Step 1: speakingurl slug — same library condenser uses
  let s = getSlug(title.replace(/[<>]/g, ''), { truncate: 128 });

  // Step 2: agar slug empty ho (e.g. pure Urdu/Arabic title)
  if (!s) {
    s = Math.random().toString(36).substring(2, 8); // fallback random
  }

  // Step 3: blockchain check — kya yeh permlink already exist karti hai?
  try {
    const client = getClient();
    const content = await client.database.call('get_content', [author, s]);
    if (content && content.body !== '') {
      // Already exists — add random prefix (exactly what condenser does)
      const prefix = Math.random().toString(36).substring(2, 8);
      return sanitizePermlink(`${prefix}-${s}`);
    }
  } catch (err) {
    // Node down — proceed without check, add prefix to be safe
    console.warn('[PERMLINK] Blockchain check failed, using prefix:', err.message);
    const prefix = Math.random().toString(36).substring(2, 8);
    return sanitizePermlink(`${prefix}-${s}`);
  }

  // Does not exist — return clean slug, no prefix
  return sanitizePermlink(s);
}

export async function getAccount(username) {
  try {
    const client = getClient();
    const accounts = await client.database.getAccounts([username]);
    if (accounts && accounts.length > 0) return accounts[0];
    return null;
  } catch (err) {
    console.error('[ACCOUNT] Error:', err.message);
    return null;
  }
}

export async function publishPost({ author, title, body, tags, postingKey }) {
  // Generate permlink exactly like condenser does
  const permlink = await generatePermlink(title, author);

  const tagList = (tags || 'blurt')
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
    .filter(t => t.length > 0)
    .slice(0, 5);
  if (!tagList.length) tagList.push('blurt');

  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  console.log(`[POST] author:@${author} permlink:${permlink} tags:${tagList.join(',')}`);

  const operations = [
    [
      'comment',
      {
        parent_author: '',
        parent_permlink: tagList[0],
        author,
        permlink,
        title,
        body,
        json_metadata,
      },
    ],
  ];

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[BROADCAST] Attempt ${attempt}/3`);
      const client = getClient();
      const key = PrivateKey.from(postingKey);
      const result = await client.broadcast.sendOperations(operations, key);
      console.log(`[BROADCAST] ✅ SUCCESS | tx:${result?.id}`);
      return { permlink, result };
    } catch (err) {
      console.log(`[BROADCAST] ❌ Attempt ${attempt}: ${err.message}`);
      lastError = err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }

  throw new Error(`Broadcast failed: ${lastError?.message}`);
}