import { QRCodeSVG } from 'qrcode.react';
import { Smartphone } from 'lucide-react';
import { Brand, BrandHero } from './Brand';
import { phoneUrl } from '../navigation';

export function DesktopHandoff() {
  const url = phoneUrl(new URL(location.href));
  return (
    <main className="desktop-handoff">
      <header>
        <Brand />
        <span className="subtle-tag">Made for mobile</span>
      </header>
      <div className="handoff-content">
        <BrandHero desktop />
        <h1>
          Small screen.
          <br />
          <span>Super perps.</span>
        </h1>
        <p>
          super perps is a mobile-only experience.
          <br />
          Open it on your phone to explore Phoenix markets.
        </p>
        {url ? (
          <div className="phone-link">
            <div className="qr-code">
              <QRCodeSVG
                value={url}
                size={120}
                level="M"
                marginSize={2}
                title="Open super perps on your phone"
              />
            </div>
            <div>
              <strong>Scan. Explore. Make it yours.</strong>
              <p>Use your phone’s camera to open super perps.</p>
            </div>
          </div>
        ) : (
          <div className="phone-link local-handoff">
            <Smartphone size={28} />
            <div>
              <strong>You’re viewing a local build</strong>
              <p>
                A phone QR code appears when this app is hosted on HTTPS. This localhost address
                only works on this computer.
              </p>
            </div>
          </div>
        )}
        {import.meta.env.DEV && (
          <a
            className="secondary-button"
            href={`${location.pathname}${location.search ? `${location.search}&` : '?'}preview=mobile`}
          >
            Open developer mobile preview
          </a>
        )}
      </div>
      <footer>
        <p>Educational & experimental · Trading involves real funds and risk</p>
      </footer>
    </main>
  );
}
