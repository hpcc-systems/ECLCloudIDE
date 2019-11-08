const crypto = require('crypto');

let crypt = {};

crypt.encrypt = (msg) => {
  let key = process.env.SECRET,
      iv = crypto.randomBytes(16),
      cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv),
      encrypted = cipher.update(msg);

  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + encrypted.toString('hex');
};

crypt.decrypt = (msg) => {
  let key = process.env.SECRET,
      iv = Buffer.from(msg.substr(0, 32), 'hex'),
      encryptedText = Buffer.from(msg.substr(32), 'hex'),
      decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv),
      decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

module.exports = crypt;