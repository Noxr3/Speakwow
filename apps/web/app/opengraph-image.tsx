import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Speakwow — A voice teacher who remembers you.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // Bundled local asset: no preview URL, remote config, or external font dependency.
  const logo = await readFile(join(process.cwd(), 'public/brand/icon-512.png'));

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          color: '#f0f7f4',
          backgroundColor: '#0c1715',
          backgroundImage: 'radial-gradient(ellipse at 100% 100%, #174e3d 0%, #0c1715 65%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img
            src={`data:image/png;base64,${logo.toString('base64')}`}
            alt=""
            width={80}
            height={80}
            style={{ borderRadius: 18 }}
          />
          <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-1px' }}>Speakwow</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            marginTop: 26,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: '-3px',
            }}
          >
            <span>A voice teacher</span>
            <span>who remembers you.</span>
          </div>
          <div style={{ fontSize: 28, color: '#adc2b9' }}>
            Real conversation. A course of your own.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 20, color: '#adc2b9' }}>Open-source AI tutoring</span>
          <span style={{ fontSize: 20, color: '#52e0b0' }}>speakwow.ai</span>
        </div>
      </div>
    ),
    size
  );
}
