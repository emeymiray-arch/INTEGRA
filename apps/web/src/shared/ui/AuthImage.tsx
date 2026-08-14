import { useEffect, useState } from 'react';
import { apiClient } from '@/shared/api/client';

export function AuthImage({
  fileId,
  alt,
  className,
}: {
  fileId: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<{ url?: string }>(`/files/${fileId}/preview`)
      .then(({ data }) => {
        if (cancelled || !data?.url) return;
        setSrc(data.url);
      })
      .catch(() => {
        if (!cancelled) setSrc(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-integra-gray-50 text-xs text-integra-gray-600 ${className ?? ''}`}>
        {alt}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
