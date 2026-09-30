const ACCOUNT_ID_REGEX = /^0\.0\.\d+$/;
const ALIAS_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

function validateAccountId(accountId) {
  if (typeof accountId !== "string" || !ACCOUNT_ID_REGEX.test(accountId)) {
    throw new Error(
      "Invalid Hedera account ID. Expected format: 0.0.xxxxx"
    );
  }

  return accountId;
}

function validateAlias(alias) {
  if (typeof alias !== "string" || !ALIAS_REGEX.test(alias)) {
    throw new Error(
      "Invalid alias. Use 1-32 characters: letters, numbers, _ or -."
    );
  }

  return alias;
}

function parseHbarAmount(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("HBAR amount must be a number.");
  }

  const text = String(value).trim();

  if (!/^\d+(\.\d{1,8})?$/.test(text)) {
    throw new Error(
      "Invalid HBAR amount. Use a positive number with at most 8 decimals."
    );
  }

  const amount = Number(text);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("HBAR amount must be greater than 0.");
  }

  return amount;
}

function validateMemo(memo) {
  if (memo === undefined || memo === null) {
    return undefined;
  }

  const text = String(memo);

  if (text.length > 100) {
    throw new Error("Memo must not exceed 100 characters.");
  }

  return text;
}

module.exports = {
  validateAccountId,
  validateAlias,
  parseHbarAmount,
  validateMemo,
};