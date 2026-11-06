"use client";

import { useState } from 'react';
import styles from './ProductShare.module.css';

export function ProductShare({ productId, name }: { productId: string; name: string }) {
  const [status, setStatus] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [busy, setBusy] = useState(false);

  function productUrl() {
    return new URL('/catalogue/product-id/' + encodeURIComponent(productId), window.location.origin).href;
  }

  async function copyLink() {
    const url = productUrl();
    setStatus('');
    setFallbackUrl('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setStatus('Product link copied.');
    } catch {
      setFallbackUrl(url);
      setStatus('Select and copy the product link below.');
    }
  }

  async function share() {
    if (busy) return;
    setStatus('');
    setFallbackUrl('');
    if (!navigator.share) { await copyLink(); return; }
    setBusy(true);
    try {
      await navigator.share({ title: name + ' | Luminoza', text: 'Take a look at ' + name + ' on Luminoza.', url: productUrl() });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) await copyLink();
    } finally { setBusy(false); }
  }

  function whatsapp() {
    const text = 'Take a look at ' + name + ' on Luminoza: ' + productUrl();
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }

  return <section className={styles.root} aria-label="Share this product with friends">
    <div className={styles.actions}>
      <button type="button" onClick={() => void share()} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
        {busy ? 'Opening share…' : 'Share product'}
      </button>
      <button type="button" onClick={whatsapp}>WhatsApp</button>
      <button type="button" onClick={() => void copyLink()}>Copy link</button>
    </div>
    <p className={styles.status} role="status" aria-live="polite">{status}</p>
    {fallbackUrl && <label className={styles.fallback}>Product link<input readOnly value={fallbackUrl} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}/></label>}
  </section>;
}
