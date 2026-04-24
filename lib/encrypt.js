import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const IV_LENGTH = 16;

export function encrypt(text) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }
  const [ivHex, ...rest] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(rest.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}