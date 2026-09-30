const { Client, PrivateKey } = require("@hashgraph/sdk");
require("dotenv").config();

const network = process.env.HEDERA_NETWORK || "testnet";

if (!["testnet", "previewnet"].includes(network)) {
  throw new Error(
    "Invalid HEDERA_NETWORK. Only testnet or previewnet are allowed."
  );
}

const accountId = process.env.MY_ACCOUNT_ID;
const privateKeyString = process.env.MY_PRIVATE_KEY;

if (!accountId || !privateKeyString) {
  throw new Error(
    "MY_ACCOUNT_ID and MY_PRIVATE_KEY must be defined in .env"
  );
}

const privateKey = PrivateKey.fromStringDer(privateKeyString);

function getClient() {
  const client =
    network === "previewnet"
      ? Client.forPreviewnet()
      : Client.forTestnet();

  client.setOperator(accountId, privateKey);

  return client;
}

module.exports = {
  network,
  accountId,
  privateKey,
  getClient,
};