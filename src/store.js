const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const storePath = path.resolve(
  process.env.WALLET_STORE || "wallets.enc.json"
);

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_LENGTH);
}

function getPassphrase() {
  const passphrase = process.env.WALLET_PASSPHRASE;

  if (!passphrase || passphrase.length < 8) {
    throw new Error(
      "WALLET_PASSPHRASE must be defined and contain at least 8 characters."
    );
  }

  return passphrase;
}

function encrypt(data) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(getPassphrase(), salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ALGORITHM,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

function decrypt(payload) {
  if (!payload || payload.version !== 1) {
    throw new Error("Invalid encrypted wallet store.");
  }

  const salt = Buffer.from(payload.salt, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");
  const encrypted = Buffer.from(payload.data, "hex");

  const key = deriveKey(getPassphrase(), salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

function loadStore() {
  if (!fs.existsSync(storePath)) {
    return {};
  }

  const raw = fs.readFileSync(storePath, "utf8");

  if (!raw.trim()) {
    return {};
  }

  return decrypt(JSON.parse(raw));
}

function saveStore(store) {
  const encrypted = encrypt(store);

  fs.writeFileSync(
    storePath,
    JSON.stringify(encrypted, null, 2),
    "utf8"
  );
}

function setWallet(alias, wallet) {
  const store = loadStore();
  store[alias] = wallet;
  saveStore(store);
}

function getWallet(alias) {
  const store = loadStore();
  return store[alias] || null;
}

function listWallets() {
  return loadStore();
}

function deleteWallet(alias) {
  const store = loadStore();

  if (!store[alias]) {
    return false;
  }

  delete store[alias];
  saveStore(store);

  return true;
}

module.exports = {
  loadStore,
  saveStore,
  setWallet,
  getWallet,
  listWallets,
  deleteWallet,
};