import mongoose from 'mongoose';

const ScheduledPostSchema = new mongoose.Schema(
  {
    account_name: {
      type: String,
      required: true,
      trim: true,
    },
    posting_key_encrypted: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    tags: {
      type: String,
      default: 'blurt',
    },
    scheduled_time: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'done', 'failed'],
      default: 'pending',
    },
    permlink: {
      type: String,
      default: null,
    },
    error_message: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ScheduledPostSchema.index({ status: 1, scheduled_time: 1 });

export default mongoose.models.ScheduledPost ||
  mongoose.model('ScheduledPost', ScheduledPostSchema);