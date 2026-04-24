import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema({
  account_name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  posting_key_encrypted: {
    type: String,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Account ||
  mongoose.model('Account', AccountSchema);