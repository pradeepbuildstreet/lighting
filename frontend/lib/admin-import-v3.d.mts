type Row=Record<string,any>;
export function indexFiles(input:File[]):{files:Map<string,File>;duplicates:Set<string>};
export function digest(bytes:BufferSource,subtle?:SubtleCrypto):Promise<string>;
export function buildManifest(rows:Row[],input:File[],subtle?:SubtleCrypto):Promise<{path:string;size:number;sha256:string}[]>;
export function validateJob(p:Row):Row;
export function readReceipt(raw:unknown):Row|null;
export function isStaged(job:Row,file:Row):boolean;
