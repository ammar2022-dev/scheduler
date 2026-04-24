import dbConnect from '../../../lib/mongodb';
import ScheduledPost from '../../../models/ScheduledPost';

export default async function handler(req, res) {
  const { id } = req.query;
  const { username } = req.method === 'DELETE' ? req.body : req.query;

  if (!id) {
    return res.status(400).json({ error: 'Post id required' });
  }

  if (req.method === 'DELETE') {
    if (!username) {
      return res.status(400).json({ error: 'username required' });
    }

    try {
      await dbConnect();

      const post = await ScheduledPost.findOne({
        _id: id,
        account_name: username.toLowerCase().trim(),
      });

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if (post.status !== 'pending') {
        return res.status(400).json({ error: `Cannot delete post with status: ${post.status}` });
      }

      await ScheduledPost.deleteOne({ _id: id });

      return res.status(200).json({ success: true, message: 'Post cancelled' });
    } catch (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ error: 'Failed to delete: ' + err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      await dbConnect();
      const post = await ScheduledPost.findById(id)
        .select('-posting_key_encrypted')
        .lean();

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      return res.status(200).json({ success: true, post });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch post: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}