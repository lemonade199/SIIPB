'use client';

import QRCode from 'qrcode';
import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/ui/icon';

/** QR Code berbasis SVG (dibuat di browser, tanpa CDN — tetap berfungsi offline). */
export function QrCode({ value, className = 'qr-box', style }: { value: string; className?: string; style?: CSSProperties }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div className={className} style={style} title={value} role="img" aria-label={`QR ${value}`}>
      {svg ? (
        <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="qr-fallback">
          <Icon name="qr" size={40} className="mx-auto" />
          {failed ? value : ''}
        </div>
      )}
    </div>
  );
}
