export function usesStorefrontFrame(path=''){return typeof path==='string'&&path.startsWith('/')&&!/^\/(?:admin|api|offer)(?:\/|$)/.test(path);}
