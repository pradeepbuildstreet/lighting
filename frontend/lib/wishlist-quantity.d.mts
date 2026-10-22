export const MAX_QUANTITY: number;
export function quantityInput(value: string): number | null;
export function createWishlistQueue(): { run<T>(work: () => Promise<T>): Promise<T> };
export function lineAmount(unitPrice: number | string, quantity: number): number;
