// ethers v6 transaction receipts have no `receipt.events` (that was ethers v5).
// Events must be decoded from `receipt.logs` using the contract interface.

/** Returns the first decoded event with this name, or undefined. */
export function findEvent(receipt, contract, name) {
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === name) return parsed;
    } catch {
      // log from another contract or an unknown event: ignore
    }
  }
  return undefined;
}

/** Returns every decoded event with this name. */
export function filterEvents(receipt, contract, name) {
  const found = [];
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === name) found.push(parsed);
    } catch {
      // ignore
    }
  }
  return found;
}

/**
 * ethers v6 does not decode custom errors when a transaction is SENT, so a failed
 * call only says "execution reverted (unknown custom error)". This decodes the
 * error data with the contract ABI and puts the error name (for example
 * "InvalidStatus") at the front of err.message, so the existing
 * `err.message.includes("InvalidStatus")` checks in the hooks work.
 */
export function withRevertName(err, contract) {
  try {
    const raw = err?.data ?? err?.info?.error?.data?.data ?? err?.error?.data ?? err?.info?.error?.data
    const hex = typeof raw === "string" ? raw : raw?.data
    if (typeof hex === "string" && hex.startsWith("0x") && hex.length >= 10) {
      const parsed = contract.interface.parseError(hex)
      if (parsed && !String(err.message).includes(parsed.name)) {
        err.message = `${parsed.name}: ${err.message}`
      }
    }
  } catch {
    // not a custom error of this contract: leave the message as it is
  }
  return err
}
