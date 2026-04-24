import blurt from '@blurtfoundation/blurtjs';

// api.blurt.blog IS reachable — configure blurtjs to use it
blurt.api.setOptions({
  url: 'https://api.blurt.blog',
  useAppbaseApi: true,
});

blurt.config.set('address_prefix', 'BLT');
blurt.config.set('chain_id', 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c');

// Verify account exists on Blurt
export async function getAccount(username) {
  return new Promise((resolve) => {
    blurt.api.getAccounts([username], (err, result) => {
      if (err || !result || result.length === 0) {
        console.error('getAccount error:', err?.message || 'Not found');
        resolve(null);
      } else {
        resolve(result[0]);
      }
    });
  });
}

// Publish post to Blurt blockchain
export async function publishPost({ author, title, body, tags, postingKey }) {
  const permlink =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200) +
    '-' +
    Date.now();

  const tagList = tags
    ? tags.split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)
    : ['blurt'];

  if (tagList.length === 0) tagList.push('blurt');

  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  return new Promise((resolve, reject) => {
    blurt.broadcast.comment(
      postingKey,
      '',
      tagList[0],
      author,
      permlink,
      title,
      body,
      json_metadata,
      (err, result) => {
        if (err) {
          reject(new Error(err.message || JSON.stringify(err)));
        } else {
          resolve({ permlink, result });
        }
      }
    );
  });
}