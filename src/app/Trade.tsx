import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, CirclePlus, Info } from 'lucide-react';
import { computeDraftOrderMarginRequirementFromInputs } from '@ellipsis-labs/rise';
import { crossMarketSupported, previewOrderSize } from '../phoenix/presentation';
import { fundingRateView } from '../phoenix/funding';
import { useWalletSession } from '../wallet/session';
import { WalletStatus } from '../wallet/WalletStatus';
import { useTrading } from '../trading/state';
import { availableOrderSize } from '../trading/service';
import type { OrderRequest } from '../trading/types';
import { Exact, fromLots, toLots, toTicks } from '../trading/math';
import { positionView } from '../trading/position-view';
import { openOrderViews } from '../trading/order-view';
import { conditionalOrderViews } from '../trading/conditional-order-view';
import { useMarkets, useOrderBook, type Timeframe } from './market-data';
import { percent, price, quantity, usdc } from './format';
import { AssetIcon } from './components/AssetIcon';
import { MarketList } from './components/MarketList';
import { Sheet } from './components/Sheet';
import { SelectionTabs } from './components/SelectionTabs';
import { OrderBook } from './components/OrderBook';
import { TradingAccountPanel } from './components/TradingAccountPanel';
import { ChartDock } from './components/CandleChart';
import { normalizeDecimalInput } from './decimal-input';

export function Trade({
  symbol,
  onSelect,
  chartOpen,
  toggleChart,
  timeframe,
  setTimeframe,
  openFunding,
}: {
  symbol: string;
  onSelect: (value: string) => void;
  chartOpen: boolean;
  toggleChart: () => void;
  timeframe: Timeframe;
  setTimeframe: (value: Timeframe) => void;
  openFunding: () => void;
}) {
  const { markets, data, error: marketError, retry: retryMarkets } = useMarkets();
  const market = markets.find((m) => m.symbol === symbol);
  const stats = data?.marketsBySymbol[symbol];
  const { book, stale, error, retry } = useOrderBook(symbol);
  const wallet = useWalletSession();
  const trading = useTrading();
  const account = trading.account;
  const [sheet, setSheet] = useState<
    'markets' | 'type' | 'unit' | 'margin' | 'time-in-force' | 'funding-rate' | null
  >(null);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [intent, setIntent] = useState<'open' | 'close'>('open');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [unit, setUnit] = useState<'base' | 'quote'>('base');
  const [amount, setAmount] = useState('');
  const [allocation, setAllocation] = useState(0);
  const [limitPrice, setLimitPrice] = useState('');
  const [exits, setExits] = useState(false);
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [fieldError, setFieldError] = useState('');
  const funding = fundingRateView(stats, data?.status);
  const ticketIdentity = useRef('');
  ticketIdentity.current = JSON.stringify([
    wallet.selected,
    symbol,
    orderType,
    intent,
    side,
    unit,
    amount,
    allocation,
    limitPrice,
    exits,
    takeProfit,
    stopLoss,
  ]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const supported = !!market && crossMarketSupported(market);
  const maxLeverage = market
    ? Math.max(...market.leverageTiers.map((t) => t.maxLeverage))
    : undefined;
  // In Close mode, the selection describes the position being closed, so execution uses the opposite side.
  const executionSide = intent === 'close' ? (side === 'long' ? 'short' : 'long') : side;
  const reference =
    orderType === 'limit'
      ? limitPrice
      : String((executionSide === 'long' ? book?.asks[0]?.[0] : book?.bids[0]?.[0]) ?? '');
  const draft: Omit<OrderRequest, 'baseUnits'> = {
    kind: 'order',
    symbol,
    side: executionSide,
    orderType,
    reduceOnly: intent === 'close',
    limitPrice: orderType === 'limit' ? limitPrice : undefined,
    takeProfit: exits && intent === 'open' ? takeProfit || undefined : undefined,
    stopLoss: exits && intent === 'open' ? stopLoss || undefined : undefined,
  };
  let maxBase = '0';
  let estimatedMargin: string | undefined;
  let sizePreview: ReturnType<typeof previewOrderSize> | undefined;
  try {
    if (account && !trading.stale && reference)
      maxBase = availableOrderSize(account, draft, reference);
    if (market && amount && reference) {
      const size = previewOrderSize(amount, unit, reference, market.baseLotsDecimals);
      sizePreview = size;
      const params = account?.params.paramsBySymbol[symbol];
      if (account?.inputs && params && !trading.stale)
        estimatedMargin = fromLots(
          computeDraftOrderMarginRequirementFromInputs({
            subaccount: account.inputs,
            markets: Object.values(account.params.paramsBySymbol),
            options: { spotCollateralParams: account.params.spotCollaterals },
            draftOrder: {
              symbol,
              side: executionSide === 'long' ? 'bid' : 'ask',
              orderType,
              priceTicks: toTicks(reference, params),
              sizeBaseLots: toLots(size.baseUnits, market.baseLotsDecimals),
              reduceOnly: intent === 'close',
            },
          }).marginRequirementQuoteLots,
          6,
        );
    }
  } catch {
    /* Incomplete decimal input is validated when the user requests review. */
  }
  const chartPosition = positionView(account, symbol, wallet.selected, trading.stale);
  const orders = useMemo(
    () => openOrderViews(account, wallet.selected),
    [account, wallet.selected],
  );
  const chartOrders = useMemo(
    () => (trading.stale ? [] : orders.filter((order) => order.symbol === symbol)),
    [orders, symbol, trading.stale],
  );
  const chartTriggers = useMemo(
    () => conditionalOrderViews(account, wallet.selected, trading.stale),
    [account, wallet.selected, trading.stale],
  );
  const readyForAccount = !!wallet.selected && !!account && !trading.stale;
  const setupRequired =
    account &&
    (!account.registered ||
      (account.subaccount?.capabilities ?? account.state?.snapshot.capabilities)?.state ===
        'uninitialized');
  function resetSize() {
    setAllocation(0);
    setAmount('');
    setFieldError('');
  }
  function allocate(value: number) {
    setAllocation(value);
    setFieldError('');
    if (!market || value === 0) {
      setAmount('');
      return;
    }
    const lots = new Exact(maxBase)
      .mul(new Exact(10).pow(market.baseLotsDecimals))
      .mul(value)
      .div(100)
      .floor();
    const base = fromLots(lots.toFixed(0), market.baseLotsDecimals);
    setAmount(unit === 'base' ? base : new Exact(base).mul(reference).toFixed());
  }
  async function submit() {
    setFieldError('');
    if (!wallet.authenticated) {
      wallet.login();
      return;
    }
    if (!wallet.selected) {
      setFieldError(wallet.error ?? 'Wait for your wallet to finish loading.');
      return;
    }
    if (setupRequired) {
      openFunding();
      return;
    }
    try {
      if (!market || !supported || stale || error || !readyForAccount)
        throw new Error('Wait for fresh market and account data.');
      if (exits && intent === 'open' && !takeProfit && !stopLoss)
        throw new Error('Enter a take-profit or stop-loss price.');
      const size = previewOrderSize(amount, unit, reference, market.baseLotsDecimals);
      const reviewedTicket = ticketIdentity.current;
      await trading.review({ ...draft, baseUnits: size.baseUnits }, () => {
        // Only this confirmed ticket may clear itself, never a later draft or another market.
        if (!mounted.current || ticketIdentity.current !== reviewedTicket) return;
        resetSize();
        setLimitPrice('');
        setExits(false);
        setTakeProfit('');
        setStopLoss('');
      });
    } catch (cause) {
      setFieldError(cause instanceof Error ? cause.message : 'Check the order size.');
    }
  }

  return (
    <div className="trade-view">
      <header className="trade-header">
        <button
          className="market-selector"
          onClick={() => setSheet('markets')}
          aria-label={`Select market, current ${symbol}`}
        >
          <AssetIcon symbol={symbol} />
          <span>
            <strong>
              {symbol}
              <span className="perp-tag">PERP</span>
              <ChevronDown size={17} />
            </strong>
            <small>USDC perpetual</small>
          </span>
        </button>
        <div className="header-price">
          <strong>{price(stats?.markPrice)}</strong>
          <span className={(stats?.priceChange24hPercent ?? 0) < 0 ? 'negative' : 'positive'}>
            {percent(stats?.priceChange24hPercent)} <small>24h</small>
          </span>
        </div>
      </header>
      <div className="trade-scroll">
        {marketError && (
          <div className="market-unavailable">
            Market details unavailable.{' '}
            <button className="text-button" onClick={retryMarkets}>
              Retry
            </button>
          </div>
        )}
        {!supported && markets.length > 0 && (
          <div className="market-unavailable">
            {market?.isolatedOnly
              ? 'This market requires isolated margin. super perps supports cross margin.'
              : 'This market is not available for trading.'}
          </div>
        )}
        <div className="trade-workspace">
          <section className="order-ticket" aria-label="Order ticket">
            <div className="ticket-settings">
              <button onClick={() => setSheet('margin')}>
                Cross
                <Info size={12} />
              </button>
              <button onClick={() => setSheet('margin')}>
                {maxLeverage && Number.isFinite(maxLeverage) ? `Up to ${maxLeverage}×` : 'Margin'}
                <Info size={12} />
              </button>
            </div>
            <SelectionTabs
              className="segmented"
              variant="pill"
              label="Order intention"
              value={intent}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'close', label: 'Close' },
              ]}
              onChange={(value) => {
                setIntent(value);
                resetSize();
              }}
            />
            <div className="direction-toggle" data-side={side} aria-label="Position direction">
              {(['long', 'short'] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={side === v}
                  onClick={() => {
                    setSide(v);
                    resetSize();
                  }}
                >
                  {v === 'long' ? 'Long' : 'Short'}
                </button>
              ))}
            </div>
            <button className="field-button" onClick={() => setSheet('type')}>
              <span>{orderType === 'market' ? 'Market' : 'Limit'}</span>
              <ChevronDown size={15} />
            </button>
            {orderType === 'limit' ? (
              <label className="trade-input">
                <span>
                  Price <small>USD</small>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Limit price"
                  value={limitPrice}
                  onChange={(e) => {
                    setLimitPrice(normalizeDecimalInput(e.target.value));
                    setAllocation(0);
                    setFieldError('');
                  }}
                />
              </label>
            ) : (
              <div className="market-price-field">
                <span>Market price</span>
                <strong>Best available</strong>
              </div>
            )}
            <div className="amount-field">
              <label htmlFor="order-amount">{unit === 'quote' ? 'Order value' : 'Quantity'}</label>
              <button className="unit-selector" onClick={() => setSheet('unit')}>
                {unit === 'quote' ? 'USDC' : symbol}
                <ChevronDown size={12} />
              </button>
              <input
                id="order-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Amount"
                value={amount}
                aria-invalid={!!fieldError}
                aria-describedby="order-size-summary order-error"
                onChange={(e) => {
                  setAmount(normalizeDecimalInput(e.target.value));
                  setAllocation(0);
                  setFieldError('');
                }}
              />
            </div>
            <div className="size-slider" data-side={side}>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                aria-label="Percentage of available order size"
                value={allocation}
                disabled={!readyForAccount || maxBase === '0'}
                onChange={(e) => allocate(Number(e.target.value))}
                style={{ '--range-progress': `${allocation}%` } as CSSProperties}
              />
              <div className="slider-marks">
                {[0, 25, 50, 75, 100].map((n) => (
                  <span key={n}>{n === 0 || n === 100 ? `${n}%` : <i />}</span>
                ))}
              </div>
            </div>
            <div className="notional-estimate" id="order-size-summary">
              <span>{orderType === 'market' ? 'Est. order value' : 'Order value'}</span>
              <strong>
                {sizePreview ? usdc(Number(sizePreview.notional)) : '—'} <small>USDC</small>
              </strong>
              {unit === 'quote' && sizePreview && (
                <>
                  <span>
                    {sizePreview.baseUnits} {symbol}
                  </span>
                  {sizePreview.rounded && (
                    <span className="size-rounding-note">
                      Rounded down to {sizePreview.lotSize} {symbol} steps.
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="ticket-options">
              {intent === 'open' && (
                <label className="tpsl-toggle">
                  <input
                    type="checkbox"
                    checked={exits}
                    onChange={(e) => setExits(e.target.checked)}
                  />
                  <span>TP/SL</span>
                </label>
              )}
              <button
                className="time-in-force"
                aria-label={`Time in force: ${orderType === 'limit' ? 'GTC' : 'FOK'}`}
                onClick={() => setSheet('time-in-force')}
              >
                <span>Time in force</span>
                <strong>{orderType === 'limit' ? 'GTC' : 'FOK'}</strong>
              </button>
            </div>
            {intent === 'open' && exits && (
              <div className="tpsl-fields">
                <label className="trade-input">
                  <span>
                    Take profit <small>USD</small>
                  </span>
                  <input
                    aria-label="Take profit price"
                    inputMode="decimal"
                    placeholder="TP price"
                    value={takeProfit}
                    autoComplete="off"
                    onChange={(e) => setTakeProfit(normalizeDecimalInput(e.target.value))}
                  />
                </label>
                <label className="trade-input">
                  <span>
                    Stop loss <small>USD</small>
                  </span>
                  <input
                    aria-label="Stop loss price"
                    inputMode="decimal"
                    placeholder="SL price"
                    value={stopLoss}
                    autoComplete="off"
                    onChange={(e) => setStopLoss(normalizeDecimalInput(e.target.value))}
                  />
                </label>
              </div>
            )}
            <div className="free-margin">
              <span>Free margin</span>
              <button onClick={openFunding} aria-label="Add USDC collateral">
                <b>
                  {account && !trading.stale ? usdc(Number(fromLots(account.freeMargin, 6))) : '—'}{' '}
                  <span className="margin-unit">USDC</span>
                </b>
                <CirclePlus size={14} />
              </button>
            </div>
            <div className="ticket-estimates">
              <div>
                <span>Est. margin</span>
                <span>{estimatedMargin ? usdc(Number(estimatedMargin)) : '—'} USDC</span>
              </div>
              <div>
                <span>Max size</span>
                <span>
                  {readyForAccount ? quantity(Number(maxBase)) : '—'} {symbol}
                </span>
              </div>
            </div>
            <p id="order-error" className="inline-error" role="alert">
              {fieldError}
            </p>
            <button
              className={`${side === 'long' ? 'long-button' : 'short-button'} ticket-submit`}
              onClick={() => void submit()}
              disabled={
                trading.busy ||
                !wallet.ready ||
                !wallet.configured ||
                (wallet.authenticated &&
                  (!wallet.selected ||
                    !account ||
                    trading.stale ||
                    (!setupRequired && (!supported || stale || !!error))))
              }
            >
              {!wallet.authenticated
                ? 'Sign up / Log in'
                : !wallet.selected
                  ? wallet.error
                    ? 'Wallet unavailable'
                    : 'Loading wallet…'
                  : setupRequired
                    ? 'Set up trading'
                    : `${intent === 'close' ? 'Close' : 'Open'} ${side === 'long' ? 'Long' : 'Short'}`}
            </button>
            <WalletStatus />
            {!wallet.configured && <p className="quiet-note">Wallet login is not configured.</p>}
            {intent === 'close' && <p className="ticket-footnote">Reduce only</p>}
          </section>
          <OrderBook
            symbol={symbol}
            book={book}
            stale={stale}
            error={error}
            retry={retry}
            fundingLabel={funding?.label}
            onFunding={() => setSheet('funding-rate')}
          />
        </div>
        <TradingAccountPanel />
      </div>
      <ChartDock
        symbol={symbol}
        expanded={chartOpen}
        onToggle={toggleChart}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        position={chartPosition}
        orders={chartOrders}
        triggers={chartTriggers}
      />
      <Sheet open={sheet === 'markets'} onClose={() => setSheet(null)} title="Select market" tall>
        <MarketList
          onSelect={(value) => {
            setSheet(null);
            onSelect(value);
          }}
        />
      </Sheet>
      <Sheet open={sheet === 'type'} onClose={() => setSheet(null)} title="Order type">
        <div className="order-type-options">
          {(['market', 'limit'] as const).map((v) => (
            <button
              className={`choice-row ${orderType === v ? 'selected' : ''}`}
              key={v}
              aria-pressed={orderType === v}
              onClick={() => {
                setOrderType(v);
                setSheet(null);
                resetSize();
              }}
            >
              <strong>{v === 'market' ? 'Market order' : 'Limit order'}</strong>
              <span>
                {v === 'market'
                  ? 'Fill the full size at available prices within 0.5%, or cancel.'
                  : 'Buy or sell at your chosen price or better.'}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'funding-rate'}
        onClose={() => setSheet(null)}
        title={`${symbol} funding`}
      >
        <div className="info-panel">
          <strong>
            {funding
              ? `${funding.label} per hour · ${funding.direction}`
              : 'Waiting for fresh funding data'}
          </strong>
          <p>
            Funding is paid between long and short positions. Phoenix accrues funding continuously
            and settles hourly. The rate can change.
          </p>
          <p>
            This rate is separate from trading fees. A position’s unsettled funding appears in its
            card; it is not included in the price P&amp;L.
          </p>
        </div>
      </Sheet>
      <Sheet open={sheet === 'time-in-force'} onClose={() => setSheet(null)} title="Time in force">
        <div className="info-panel">
          <strong>
            {orderType === 'limit' ? 'GTC · Good till cancelled' : 'FOK · Fill or kill'}
          </strong>
          <p>
            {orderType === 'limit'
              ? 'Your limit order stays on the book until it fills or is cancelled. Any unfilled size remains open after a partial fill.'
              : 'Your full order must fill immediately within the price limit. If it cannot, the order is cancelled.'}
          </p>
          {orderType === 'market' && (
            <p>
              A 0.5% price bound applies from the refreshed best ask for buys or best bid for sells.
              The exact maximum or minimum price is shown in your order review.
            </p>
          )}
          <p>This applies to the main order. Attached TP/SL exits use separate trigger rules.</p>
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'unit'}
        onClose={() => setSheet(null)}
        title="Order size unit"
        description="USDC is position value, not deposited collateral. The quantity rounds down to the market’s size increment; market fills can vary with price."
      >
        {(['base', 'quote'] as const).map((v) => (
          <button
            className={`choice-row ${unit === v ? 'selected' : ''}`}
            key={v}
            onClick={() => {
              setUnit(v);
              resetSize();
              setSheet(null);
            }}
          >
            <strong>{v === 'base' ? `${symbol} · quantity` : 'USDC · order value'}</strong>
          </button>
        ))}
      </Sheet>
      <Sheet open={sheet === 'margin'} onClose={() => setSheet(null)} title="Cross margin">
        <div className="info-panel">
          <p>
            All positions in this account share collateral. Losses in one position can affect the
            others.
          </p>
          <p>
            Phoenix determines margin from position size and market tiers. The size slider uses
            available capacity, reserving 5% of free margin for fees and price movement.
          </p>
          <p>
            The final transaction is simulated before you sign. Market price protection and
            stop-loss price limits can cause an order to remain unfilled in fast markets.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
