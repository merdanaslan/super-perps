import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { WalletSessionProvider, useWalletSession } from '../wallet/session';
import { MarketProvider, type Timeframe } from './market-data';
import type { Screen, Tab } from './navigation';
import { useAppRoute } from './useAppRoute';
import { Trade } from './Trade';
import { Home } from './Home';
import { Assets } from './Assets';
import { Account } from './Account';
import { MarketList } from './components/MarketList';
import { Funding, type FundingTab } from './Funding';
import { SearchMarkets } from './SearchMarkets';
import { TradingProvider } from '../trading/context';
import { DesktopHandoff } from './components/DesktopHandoff';
import { PwaStatus } from '../pwa/PwaStatus';
import { BottomNavigation } from './components/BottomNavigation';
import { useCompactNavigation } from './useCompactNavigation';
import './app.css';

function MobileApp() {
  const [route, replaceRoute] = useAppRoute();
  const [fundingTab, setFundingTab] = useState<FundingTab>();
  const [chartOpen, setChartOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const wallet = useWalletSession();
  const navigation = useCompactNavigation(`${route.screen}:${route.tab}:${route.symbol}`);
  const authRouteStarted = useRef(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const previousScreen = useRef(route.screen);
  useEffect(() => {
    if (previousScreen.current === 'search' && route.screen === 'app' && route.tab === 'home')
      searchButton.current?.focus({ preventScroll: true });
    previousScreen.current = route.screen;
  }, [route.screen, route.tab]);
  useEffect(() => {
    document.title =
      route.screen === 'app' && route.tab === 'trade'
        ? `${route.symbol} · super perps`
        : 'super perps · Educational Phoenix starter';
  }, [route]);
  function navigate(tab: Tab, symbol = route.symbol, screen: Screen = 'app') {
    replaceRoute({ tab, symbol, screen });
  }
  function closeSearch() {
    // The URL retains the underlying tab, including on a direct /search visit.
    replaceRoute({ ...route, screen: 'app' });
  }
  useEffect(() => {
    if (route.screen !== 'signup' && route.screen !== 'login') {
      authRouteStarted.current = false;
      return;
    }
    if (wallet.ready && !authRouteStarted.current) {
      authRouteStarted.current = true;
      replaceRoute({ ...route, screen: 'app' });
      if (!wallet.authenticated) wallet.login();
    }
  }, [route, replaceRoute, wallet.ready, wallet.authenticated, wallet.login]);
  const openScreen = (screen: Screen) => {
    if (screen === 'signup' || screen === 'login') {
      wallet.login();
      return;
    }
    navigate(route.tab, route.symbol, screen);
  };
  const selectMarket = (symbol: string) => navigate('trade', symbol);
  return (
    <div className="phone-shell" data-navigation={route.screen === 'app'}>
      <PwaStatus />
      <main
        className="mobile-content"
        id="main-content"
        onScrollCapture={navigation.onScrollCapture}
      >
        {route.screen !== 'app' && route.screen !== 'search' ? (
          <Account close={() => openScreen('app')} />
        ) : (
          <div
            className="app-page-layer"
            inert={route.screen === 'search'}
            aria-hidden={route.screen === 'search' || undefined}
          >
            {route.tab === 'home' && (
              <Home
                openScreen={openScreen}
                openFunding={() => setFundingTab('deposit')}
                selectMarket={selectMarket}
                go={navigate}
                searchButtonRef={searchButton}
              />
            )}
            {route.tab === 'markets' && (
              <div className="page-scroll markets-page">
                <header className="page-heading">
                  <h1>Markets</h1>
                </header>
                <MarketList onSelect={selectMarket} browse />
              </div>
            )}
            {route.tab === 'assets' && <Assets openFunding={setFundingTab} />}
            {route.tab === 'trade' && (
              <Trade
                key={`${route.symbol}:${wallet.selected ?? 'none'}`}
                symbol={route.symbol}
                onSelect={selectMarket}
                chartOpen={chartOpen}
                toggleChart={() => setChartOpen((open) => !open)}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                openFunding={() => setFundingTab('deposit')}
              />
            )}
          </div>
        )}
        {route.screen === 'search' && <SearchMarkets close={closeSearch} onSelect={selectMarket} />}
      </main>
      {route.screen === 'app' && (
        <BottomNavigation
          tab={route.tab}
          compact={navigation.compact}
          onNavigate={navigate}
          onExpand={navigation.expand}
        />
      )}
      <Funding
        key={wallet.selected ?? 'none'}
        open={!!fundingTab}
        initialTab={fundingTab}
        close={() => setFundingTab(undefined)}
      />
    </div>
  );
}

const mobileQuery = '(max-width: 767px)';
function subscribeViewport(callback: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

export default function App() {
  const mobile = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia(mobileQuery).matches,
  );
  // Compile-time dev gate. A production URL cannot opt into the desktop terminal.
  const preview =
    import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'mobile';
  if (!mobile && !preview) return <DesktopHandoff />;
  return (
    <div className={preview ? 'developer-preview' : undefined}>
      {preview && <div className="developer-preview-label">Mobile preview · development only</div>}
      <MarketProvider>
        <WalletSessionProvider>
          <TradingProvider>
            <MobileApp />
          </TradingProvider>
        </WalletSessionProvider>
      </MarketProvider>
    </div>
  );
}
