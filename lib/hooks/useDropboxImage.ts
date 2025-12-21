import { useState, useEffect } from 'react';

export function useDropboxImage(imagePath: string | null | undefined) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadImageUrl() {
      if (!imagePath || !imagePath.trim()) {
        setImgSrc('');
        return;
      }

      // Если это уже HTTP URL (старые данные)
      if (imagePath.startsWith('http')) {
        setImgSrc(imagePath);
        return;
      }

      // Если это локальный путь
      if (imagePath.startsWith('public/')) {
        setImgSrc('/' + imagePath.replace(/^public\//, ''));
        return;
      }

      // Если это путь в Dropbox (/products/...)
      if (imagePath.startsWith('/products/')) {
        setLoading(true);
        setError(false);
        try {
          const res = await fetch('/api/dropbox/temp-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: imagePath }),
          });

          if (res.ok) {
            const data = await res.json();
            setImgSrc(data.url);
          } else {
            console.error('Failed to get temp link:', await res.text());
            setError(true);
          }
        } catch (err) {
          console.error('Error loading image URL:', err);
          setError(true);
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback для других путей
        setImgSrc('/' + imagePath.replace(/^public\//, ''));
      }
    }

    loadImageUrl();
  }, [imagePath]);

  return { imgSrc, loading, error };
}
