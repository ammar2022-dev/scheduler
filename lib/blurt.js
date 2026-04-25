const { Client, PrivateKey } = require('@beblurt/dblurt');

const RPC_NODES = [
  'https://rpc.blurt.blog',
  'https://rpc.beblurt.com',
  'https://rpc.blurt.world',
  'https://blurt-rpc.saboin.com',
];

function getClient() {
  return new Client(RPC_NODES, { timeout: 15000 });
}

export async function getAccount(username) {
  try {
    const client = getClient();
    const accounts = await client.database.getAccounts([username]);
    console.log(`[ACCOUNT] result:`, JSON.stringify(accounts));
    if (accounts && accounts.length > 0) {
      console.log(`[ACCOUNT] ✅ Found @${username}`);
      return accounts[0];
    }
    return null;
  } catch (err) {
    console.error('[ACCOUNT] Error:', err.message);
    return null;
  }
}

export async function publishPost({ author, title, body, tags, postingKey }) {
  const permlink = 'post-' + Date.now();

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