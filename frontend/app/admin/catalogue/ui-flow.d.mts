export function formSnapshot(product: Record<string, any>, other: string, integrated: string): string;
export function referenceSnapshot(record: Record<string, any>, address: string): string;
export function isDirty(current: string, baseline: string): boolean;
export function navigationBlocked(writeBusy: boolean): boolean;
export function presentation(mode: string): 'editor'|'admin-view'|'product-list';
