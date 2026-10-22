'use client';

import {useEffect} from 'react';
import Link from 'next/link';

type Props = {
  error: Error & {digest?: string};
  reset: () => void;
};

export default function ErrorPage({error, reset}: Props) {
  const development = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[product-details] Rendering failed:', error);
    }
  }, [error]);

  return (
    <section className="container py-8">
      <h1 className="text-3xl font-bold">
        Product could not be loaded
      </h1>

      <p role="alert">Please try again.</p>

      {development && (
        <div className="my-4 rounded border p-4">
          <p>Local development diagnostic:</p>

          <pre className="mt-2 whitespace-pre-wrap break-words">
            {error.name}: {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ''}
          </pre>
        </div>
      )}

      <button type="button" onClick={() => reset()}>
        Retry
      </button>

      <p>
        <Link href="/products">Browse products</Link>
      </p>
    </section>
  );
}