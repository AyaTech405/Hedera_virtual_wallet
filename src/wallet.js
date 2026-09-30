const {
  AccountCreateTransaction,
  AccountBalanceQuery,
  AccountInfoQuery,
  TransferTransaction,
  AccountDeleteTransaction,
  Hbar,
  PrivateKey,
  AccountId,
  Status,
} = require("@hashgraph/sdk");

const { accountId, getClient } = require("./config");
const {
  validateAccountId,
  validateAlias,
  parseHbarAmount,
  validateMemo,
} = require("./utils");
const {
  setWallet,
  getWallet,
  listWallets,
  deleteWallet,
} = require("./store");

async function getReceipt(transaction) {
  const receipt = await transaction.getReceipt(getClient());

  if (receipt.status !== Status.Success) {
    throw new Error(`Transaction failed: ${receipt.status.toString()}`);
  }

  return receipt;
}

async function createWallet(alias, balance = 2, memo) {
  validateAlias(alias);

  if (getWallet(alias)) {
    throw new Error(`Wallet alias "${alias}" already exists.`);
  }

  const amount = parseHbarAmount(String(balance));
  const validMemo = validateMemo(memo);

  const client = getClient();

  const walletPrivateKey = PrivateKey.generateED25519();
  const walletPublicKey = walletPrivateKey.publicKey;

  let transaction = new AccountCreateTransaction()
    .setKey(walletPublicKey)
    .setInitialBalance(Hbar.fromHbar(amount));

  if (validMemo) {
    transaction = transaction.setTransactionMemo(validMemo);
  }

  const executed = await transaction.execute(client);
  const receipt = await executed.getReceipt(client);

  if (receipt.status !== Status.Success) {
    throw new Error(`Account creation failed: ${receipt.status.toString()}`);
  }

  const newAccountId = receipt.accountId;

  if (!newAccountId) {
    throw new Error("Account creation succeeded but no account ID was returned.");
  }

  setWallet(alias, {
    accountId: newAccountId.toString(),
    privateKey: walletPrivateKey.toStringDer(),
    memo: validMemo || null,
  });

  return {
    alias,
    accountId: newAccountId.toString(),
    balance: amount,
    transactionId: executed.transactionId.toString(),
  };
}

async function getBalance(accountOrAlias) {
  const resolved = resolveWallet(accountOrAlias);

  const client = getClient();

  const balance = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(resolved.accountId))
    .execute(client);

  return balance.hbars.toString();
}

async function getInfo(accountOrAlias) {
  const resolved = resolveWallet(accountOrAlias);

  const client = getClient();

  const info = await new AccountInfoQuery()
    .setAccountId(AccountId.fromString(resolved.accountId))
    .execute(client);

  return info;
}

async function transfer(to, amount, from = null, memo = null) {
  const validAmount = parseHbarAmount(String(amount));
  const validMemo = validateMemo(memo);

  const sender = from
    ? resolveWallet(from)
    : {
        accountId,
        privateKey: null,
      };

  const recipient = resolveWallet(to, false);

  const client = getClient();

  let transaction = new TransferTransaction()
    .addHbarTransfer(
      AccountId.fromString(sender.accountId),
      Hbar.fromHbar(-validAmount)
    )
    .addHbarTransfer(
      AccountId.fromString(recipient.accountId),
      Hbar.fromHbar(validAmount)
    );

  if (validMemo) {
    transaction = transaction.setTransactionMemo(validMemo);
  }

  if (from) {
    const senderKey = PrivateKey.fromStringDer(sender.privateKey);

    transaction = await transaction.freezeWith(client);
    transaction = await transaction.sign(senderKey);
  }

  const executed = await transaction.execute(client);

  const receipt = await executed.getReceipt(client);

  if (receipt.status !== Status.Success) {
    throw new Error(`Transfer failed: ${receipt.status.toString()}`);
  }

  return {
    transactionId: executed.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

async function deleteWalletAccount(alias) {
  validateAlias(alias);

  const wallet = getWallet(alias);

  if (!wallet) {
    throw new Error(`Wallet alias "${alias}" was not found.`);
  }

  const client = getClient();

  const transaction = await new AccountDeleteTransaction()
    .setDeleteAccountId(AccountId.fromString(wallet.accountId))
    .setTransferAccountId(AccountId.fromString(accountId))
    .freezeWith(client)
    .sign(PrivateKey.fromStringDer(wallet.privateKey));

  const executed = await transaction.execute(client);
  const receipt = await executed.getReceipt(client);

  if (receipt.status !== Status.Success) {
    throw new Error(`Account deletion failed: ${receipt.status.toString()}`);
  }

  deleteWallet(alias);

  return {
    alias,
    accountId: wallet.accountId,
    transactionId: executed.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

function resolveWallet(value, allowAlias = true) {
  if (!value) {
    throw new Error("Account or alias is required.");
  }

  if (ACCOUNT_ID_REGEX.test(value)) {
    validateAccountId(value);

    return {
      accountId: value,
      privateKey: null,
    };
  }

  if (allowAlias) {
    validateAlias(value);

    const wallet = getWallet(value);

    if (!wallet) {
      throw new Error(`Wallet alias "${value}" was not found.`);
    }

    return {
      ...wallet,
      alias: value,
    };
  }

  throw new Error(`Invalid account ID: ${value}`);
}

const ACCOUNT_ID_REGEX = /^0\.0\.\d+$/;

module.exports = {
  createWallet,
  getBalance,
  getInfo,
  transfer,
  deleteWalletAccount,
  listWallets,
};