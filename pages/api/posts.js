import dbConnect from '../../lib/mongodb';
import ScheduledPost from '../../models/ScheduledPost';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }

  try {
    await dbConnect();

    const posts = await ScheduledPost.find({
      account_name: username.toLowerCase().trim(),
    })
      .select('-posting_key_encrypted')
      .sort({ scheduled_time: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ success: true, posts });
  } catch (err) {
    console.error('Get posts error:', err);
    return res.status(500).json({ error: 'Failed to fetch posts: ' + err.message });
  }
}