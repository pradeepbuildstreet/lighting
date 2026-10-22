export function canReview(audit: {status: string; product_revision: unknown} | null, product: {revision: unknown} | null, reviews?: unknown[]): boolean;
export function candidateState(candidate: {evidence?: {candidate_revision?: unknown}; current_revision?: unknown}): 'unknown'|'current'|'changed';
export function reviewError(decision: string, notes: string, target: string): string;
export function publicationAction(state: {product?: {published?: boolean}; can_publish?: boolean} | null): 'unpublish'|'publish'|'blocked';
