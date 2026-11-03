import { ArrowRight, ChevronRight, Search, UserRound, BookOpen } from 'lucide-react';
import type { Ref } from 'react';
import { isSessionLoading, useWalletSession } from '../wallet/session';
import { WalletStatus } from '../wallet/WalletStatus';
import type { Screen, Tab } from './navigation';
import { Brand, BrandHero } from './components/Brand';
import { MarketOverview } from './components/MarketOverview';
import { SessionSkeleton } from './components/SessionSkeleton';

export function Home({
  openScreen,
  openFunding,
  selectMarket,
  go,
  searchButtonRef,
}: {
  openScreen: (screen: Screen) => void;
  openFunding: () => void;
  selectMarket: (symbol: string) => void;
  go: (tab: Tab) => void;
  searchButtonRef?: Ref<HTMLButtonElement>;
}) {
  const session = useWalletSession();
  const sessionLoading = isSessionLoading(session);
  return (
    <div className="page-scroll home-page">
      <header className="home-header">
        <button
          className="icon-button profile-button"
          aria-label="Open account"
          onClick={() => openScreen('account')}
        >
          <UserRound size={25} />
        </button>
        <button ref={searchButtonRef} className="home-search" onClick={() => openScreen('search')}>
          <Search size={18} />
          <span>Search markets</span>
        </button>
        <Brand compact />
      </header>
      <section className="home-welcome">
        <BrandHero />
        <h1>
          super <span>perps</span>
        </h1>
        <p>Phoenix perps. Built for your pocket.</p>
        {sessionLoading ? (
          <div className="home-actions">
            <SessionSkeleton variant="actions" />
          </div>
        ) : session.authenticated ? (
          <div className="home-actions session-resolved">
            <div className="two-actions">
              <button className="primary-button" onClick={openFunding} disabled={!session.selected}>
                Deposit
                <ArrowRight size={16} />
              </button>
              <button className="secondary-button" onClick={() => go('assets')}>
                View assets
              </button>
            </div>
            <WalletStatus />
          </div>
        ) : (
          <>
            <div className="two-actions auth-actions session-resolved">
              <button
                className="primary-button"
                disabled={!session.ready || !session.configured}
                onClick={session.login}
              >
                Sign up
                <ArrowRight size={17} />
              </button>
              <button
                className="secondary-button"
                disabled={!session.ready || !session.configured}
                onClick={session.login}
              >
                Log in
              </button>
            </div>
            {!session.configured && (
              <p className="quiet-note">
                Sign-in is unavailable in this installation. You can still explore the markets.
              </p>
            )}
          </>
        )}
        <span className="welcome-caption">Educational & open source</span>
      </section>
      <MarketOverview onSelect={selectMarket} />
      <button className="all-markets-link" onClick={() => go('markets')}>
        Explore all perpetuals
        <ChevronRight size={17} />
      </button>
      <section className="education-card">
        <span className="education-icon">
          <BookOpen size={25} />
        </span>
        <div>
          <strong>Built to learn. Open to build.</strong>
          <p>Experimental, unaudited software for educational purposes. Use at your own risk.</p>
        </div>
      </section>
      <footer className="home-footer">
        <div className="home-footer-brands">
          <Brand />
          <a
            className="phoenix-attribution"
            href="https://www.phoenix.trade/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Powered by Phoenix (opens in a new tab)"
          >
            <span>Powered by</span>
            <span className="phoenix-attribution-name">
              <img src="/brand/phoenix-mark-orange.svg" width="18" height="20" alt="" />
              Phoenix
            </span>
          </a>
        </div>
        <p>An independent, open-source Phoenix starter.</p>
      </footer>
    </div>
  );
}
