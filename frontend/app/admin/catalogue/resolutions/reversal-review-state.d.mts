export type PendingReversal={product_id:string;body:{expected_revision:string;expected_review_id:string;expected_group_resolution_id:string|null;expected_target_product_id:string;request_key:string;reason:string}};
export type ReversalEvent=Record<string,unknown>&{id:string;product_id:string;reason:string;actor_id:string;created_at:string};
export function restoreReversalRequest(text:string):PendingReversal|null;
export function makeReversalRequest(preview:unknown,reason:string,key:string):PendingReversal;
export function verifyReversalReceipt(saved:PendingReversal,result:unknown):ReversalEvent;
