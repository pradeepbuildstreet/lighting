export const MAX_QUANTITY = 9999;
export function quantityInput(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,3}$/.test(value)) return null;
  const result = Number(value);
  return result <= MAX_QUANTITY ? result : null;
}
export function createWishlistQueue() {
  let tail = Promise.resolve();
  return { run(work) { const result = tail.then(work); tail = result.catch(() => undefined); return result; } };
}
export function lineAmount(unitPrice, quantity) { return Math.round(Number(unitPrice) * 100) * quantity / 100; }
