import dbConnect from '../../lib/mongodb';
import ScheduledPost from '../../models/ScheduledPost';
import Account from '../../models/Account';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, title, body, tags, scheduled_time } = req.body;

  if (!username || !title || !body || !scheduled_time) {
    return res.status(400).json({ error: 'username, title, body, scheduled_time required' });
  }

  const scheduledDate = new Date(scheduled_time);
  if (isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ error: 'Invalid scheduled_time format' });
  }

  if (scheduledDate <= new Date()) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  try {
    await dbConnect();

    const account = await Account.findOne({
      account_name: username.toLowerCase().trim(),
    });

    if (!account) {
      return res.status(401).json({ error: 'Account not found. Please login first.' });
    }

    const post = await ScheduledPost.create({
      account_name: username.toLowerCase().trim(),
      posting_key_encrypted: account.posting_key_encrypted,
      title: title.trim(),
      body: body.trim(),
      tags: tags ? tags.trim() : 'blurt',
      scheduled_time: scheduledDate,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Post scheduled successfully!',
      post: {
        _id: post._id,
        account_name: post.account_name,
        title: post.title,
        tags: post.tags,
        scheduled_time: post.scheduled_time,
        status: post.status,
        createdAt: post.createdAt,
      },
    });
  } catch (err) {
    console.error('Schedule error:', err);
    return res.status(500).json({ error: 'Failed to schedule: ' + err.message });
  }
}