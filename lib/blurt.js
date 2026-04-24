const NODES = [
  'https://api.blurt.blog/api',
  'https://api.blurt.blog',
  'https://blurtd.privex.io',
];

async function rpcCall(method, params) {
  for (const node of NODES) {
    try {
      console.log('Trying node:', node, 'method:', method);
      const res = await fetch(node, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: 1,
        }),
      });

      const text = await res.text();
      console.log('Response status:', res.status, 'body:', text.slice(0, 200));

      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 100));

      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      return data.result;
    } catch (err) {
      console.log('Node failed:', node, '-', err.message);
    }
  }
  throw new Error('All nodes failed');
}

export async function getAccount(username) {
  try {
    const result = await rpcCall('condenser_api.get_accounts', [[username]]);
    return result && result.length > 0 ? result[0] : null;
  } catch (err) {
    console.error('getAccount error:', err.message);
    return null;
  }
}

export async function publishPost({ author, title, body, tags, postingKey }) {
  // Dynamic import of blurtjs
  const blurtjs = await import('@blurtfoundation/blurtjs');
  const blurt = blurtjs.default || blurtjs;

  const permlink =
    title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200) +
    '-' + Date.now();

  const tagList = tags
    ? tags.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)
    : ['blurt'];
  if (!tagList.length) tagList.push('blurt');

  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  const CHAIN_ID = 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c';

  // Try each node
  const nodesToTry = [
    'https://api.blurt.blog',
    'https://blurtd.privex.io',
  ];

  let lastError;

  for (const nodeUrl of nodesToTry) {
    try {
      console.log('Trying broadcast on node:', nodeUrl);

      blurt.api.setOptions({ url: nodeUrl });
      blurt.config.set('address_prefix', 'BLT');
      blurt.config.set('chain_id', CHAIN_ID);

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Broadcast timeout after 30s')), 30000);
        blurt.broadcast.comment(
          postingKey,
          '',
          tagList[0],
          author,
          permlink,
          title,
          body,
          json_metadata,
          (err, res) => {
            clearTimeout(timeout);
            if (err) {
              reject(new Error(err.message || JSON.stringify(err)));
            } else {
              resolve(res);
            }
          }
        );
      });

      console.log('Broadcast success on:', nodeUrl);
      return { permlink, result };

    } catch (err) {
      console.log('Broadcast failed on', nodeUrl, ':', err.message);
      lastError = err;
    }
  }

  throw new Error('Broadcast failed on all nodes: ' + lastError?.message);
}