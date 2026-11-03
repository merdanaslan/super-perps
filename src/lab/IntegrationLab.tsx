import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { EducationalNotice } from '../components/EducationalNotice';
import { config } from '../config';
import { createPublicPhoenixClient, type PublicPhoenixClient } from '../phoenix/client';
import { readMarketSnapshot, sampleBookUpdates } from '../phoenix/data';

// Compile-time gate also excludes optional provider bundles from an unconfigured build.
const PrivyWalletLab = import.meta.env.VITE_PRIVY_APP_ID
  ? lazy(() => import('../wallet/PrivyWalletLab'))
  : null;
type Snapshot = Awaited<ReturnType<typeof readMarketSnapshot>>;
type Samples = Awaited<ReturnType<typeof sampleBookUpdates>>;
const readableError = (error: unknown) =>
  error instanceof Error ? error.message : 'The request failed.';
const price = (value: number | undefined | null) =>
  value === undefined || value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value);
const time = (value: number) => new Date(value).toLocaleTimeString();

class WalletErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        Wallet provider could not load. Check the configured app and allowed origin, then reload.
        Public data remains available.
      </p>
    ) : (
      this.props.children
    );
  }
}

function MarketChecks({ client, symbol }: { client: PublicPhoenixClient; symbol: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [samples, setSamples] = useState<Samples>();
  const [reading, setReading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  async function readSnapshot() {
    const signal = lifetime.current!.signal;
    setReading(true);
    setSnapshot(undefined);
    setError('');
    try {
      const result = await readMarketSnapshot(client, symbol);
      if (!signal.aborted) setSnapshot(result);
    } catch (cause) {
      if (!signal.aborted) setError(readableError(cause));
    } finally {
      if (!signal.aborted) setReading(false);
    }
  }

  async function readStream() {
    const signal = lifetime.current!.signal;
    setStreaming(true);
    setSamples(undefined);
    setError('');
    try {
      const result = await sampleBookUpdates(client, symbol, signal);
      if (!signal.aborted) setSamples(result);
    } catch (cause) {
      if (!signal.aborted) setError(readableError(cause));
    } finally {
      if (!signal.aborted) setStreaming(false);
    }
  }

  return (
    <>
      <div className="actions">
        <button onClick={() => void readSnapshot()} disabled={reading}>
          {reading ? 'Reading…' : 'Read book & candles'}
        </button>
        <button onClick={() => void readStream()} disabled={streaming}>
          {streaming ? 'Waiting for 3 updates…' : 'Sample WebSocket'}
        </button>
      </div>
      <p className="muted">
        Snapshots are fetched on request. The stream sample stops after three updates or 12 seconds.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {snapshot && (
          <div className="result">
            <h3>{snapshot.book.symbol} · HTTP snapshot</h3>
            <dl>
              <div>
                <dt>Best bid / ask (USD)</dt>
                <dd>
                  {price(snapshot.book.bids[0]?.[0])} / {price(snapshot.book.asks[0]?.[0])}
                </dd>
              </div>
              <div>
                <dt>Server slot</dt>
                <dd>{String(snapshot.book.slot)}</dd>
              </div>
              <div>
                <dt>Book received locally</dt>
                <dd>{time(snapshot.receivedAtMs)}</dd>
              </div>
              <div>
                <dt>1-hour exchange candles</dt>
                <dd>{snapshot.candles.length}</dd>
              </div>
              <div>
                <dt>Latest candle close (trade price)</dt>
                <dd>{price(snapshot.candles.at(-1)?.close)}</dd>
              </div>
            </dl>
            <p className="muted">
              Historical snapshot. Prices do not refresh automatically and are not executable
              quotes.
            </p>
          </div>
        )}
        {samples && (
          <div className="result">
            <h3>{symbol} · WebSocket sample complete</h3>
            <ol>
              {samples.map((sample, index) => (
                <li key={index}>
                  Slot {sample.slot}: {price(sample.bid)} / {price(sample.ask)} USD. Server{' '}
                  {time(sample.serverTimeMs)}; received {time(sample.receivedAtMs)}.
                </li>
              ))}
            </ol>
            <p className="muted">
              Subscription closed. This proves receipt of these messages; reconnect and gap recovery
              are separate tests.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export function IntegrationLab() {
  const [client, setClient] = useState<PublicPhoenixClient>();
  const [markets, setMarkets] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('SOL');
  const [error, setError] = useState('');

  useEffect(() => {
    const next = createPublicPhoenixClient(config.phoenixApiUrl);
    let active = true;
    setClient(next);
    void next.exchange
      .ready()
      .then((snapshot) => {
        if (active) setMarkets(snapshot.markets.map((market) => market.symbol).sort());
      })
      .catch((cause: unknown) => {
        if (active) setError(readableError(cause));
      });
    return () => {
      active = false;
      next.dispose();
    };
  }, []);

  return (
    <main>
      <header>
        <p className="eyebrow">super perps · Developer checkpoint</p>
        <h1>Integration lab</h1>
        <p>Public market data and wallet setup checks for the educational starter kit.</p>
        <p className="muted">
          Read-only diagnostics for contributors. Use the app for simulated transaction reviews.
        </p>
      </header>
      <EducationalNotice />
      <section aria-labelledby="data-heading">
        <h2 id="data-heading">1. Phoenix public data</h2>
        <p>
          Default source: mainnet public data. This lab cannot place trades, register accounts or
          move funds.
        </p>
        <p className="endpoint">
          Endpoint: <code>{config.phoenixApiUrl}</code>
        </p>
        {error && (
          <p role="alert" className="error">
            {error} Reload to retry metadata.
          </p>
        )}
        <label htmlFor="market">Canonical market</label>
        <select
          id="market"
          value={symbol}
          disabled={!markets.length}
          onChange={(event) => setSymbol(event.target.value)}
        >
          {!markets.length && (
            <option value="SOL">{error ? 'Metadata unavailable' : 'Loading markets…'}</option>
          )}
          {markets.map((market) => (
            <option key={market} value={market}>
              {market}
            </option>
          ))}
        </select>
        {markets.length > 0 && (
          <p className="muted">
            {markets.length} markets returned by Phoenix, including inactive markets.
          </p>
        )}
        {client && markets.length > 0 && (
          <MarketChecks key={symbol} client={client} symbol={symbol} />
        )}
      </section>
      <section aria-labelledby="wallet-heading">
        <h2 id="wallet-heading">2. Solana wallet boundary</h2>
        {PrivyWalletLab ? (
          <WalletErrorBoundary>
            <Suspense fallback={<p>Loading optional wallet provider…</p>}>
              <PrivyWalletLab />
            </Suspense>
          </WalletErrorBoundary>
        ) : (
          <>
            <p>
              <strong>Privy is not configured.</strong> Public browsing works without an account.
            </p>
            <p>
              To test onboarding, configure your own public Privy app ID and allowed origin as
              described in the README. No wallet is created by this screen.
            </p>
          </>
        )}
        <p className="muted">
          Login, reload recovery, iPhone/Android handoff and installed-PWA behavior require separate
          checks with a configured app. Signing is absent from this lab.
        </p>
      </section>
      <section aria-labelledby="orders-heading">
        <h2 id="orders-heading">3. Unsigned instruction checks</h2>
        <p>
          Run <code>npm run probe</code> to check public reads, streaming, bounded long/short
          orders, reduce-only flags and the unsigned registration builder using a synthetic public
          address.
        </p>
        <p>
          The probe does not simulate or execute a transaction. Unit tests and instruction
          construction do not prove a fill, registration, deposit or withdrawal.
        </p>
      </section>
      <footer>Community educational project. Not an official Phoenix exchange client.</footer>
    </main>
  );
}
