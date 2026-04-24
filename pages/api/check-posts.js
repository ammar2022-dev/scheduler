import dbConnect from '../../lib/mongodb';
import ScheduledPost from '../../models/ScheduledPost';
import { decrypt } from '../../lib/encrypt';
import { publishPost } from '../../lib/blurt';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
if (cronSecret && cronSecret !== process.env.CRON_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}

  try {
    await dbConnect();

    const now = new Date();

    const duePosts = await ScheduledPost.find({
      status: 'pending',
      scheduled_time: { $lte: now },
    }).limit(20);

    if (duePosts.length === 0) {
      return res.status(200).json({ success: true, published: 0, message: 'No posts due' });
    }

    const results = [];

    for (const post of duePosts) {
      try {
        await ScheduledPost.updateOne(
          { _id: post._id, status: 'pending' },
          { status: 'done' }
        );

        const plainKey = decrypt(post.posting_key_encrypted);

        const { permlink } = await publishPost({
          author: post.account_name,
          title: post.title,
          body: post.body,
          tags: post.tags,
          postingKey: plainKey,
        });

        await ScheduledPost.updateOne(
          { _id: post._id },
          { permlink, error_message: null }
        );

        results.push({
          id: post._id,
          account: post.account_name,
          title: post.title,
          permlink,
          status: 'done',
        });

      } catch (publishErr) {
        console.error(`Failed to publish post ${post._id}:`, publishErr);

        await ScheduledPost.updateOne(
          { _id: post._id },
          { status: 'failed', error_message: publishErr.message }
        );

        results.push({
          id: post._id,
          account: post.account_name,
          title: post.title,
          status: 'failed',
          error: publishErr.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      published: results.filter((r) => r.status === 'done').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    });
  } catch (err) {
    console.error('check-posts error:', err);
    return res.status(500).json({ error: 'Cron check failed: ' + err.message });
  }
}