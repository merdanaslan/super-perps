import { useEffect, useMemo, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts';
import { ChevronDown, ChevronUp, CandlestickChart } from 'lucide-react';
import { timeframes, useCandles, type Timeframe } from '../market-data';
import type { PositionView } from '../../trading/position-view';
import type { OpenOrderView } from '../../trading/order-view';
import type { ConditionalOrderView } from '../../trading/conditional-order-view';
import { pnl, price } from '../format';

export function CandleCanvas({
  bars,
  symbol,
  position,
  orders,
  triggers,
}: {
  bars: ReturnType<typeof useCandles>['bars'];
  symbol: string;
  position?: PositionView;
  orders?: readonly OpenOrderView[];
  triggers?: readonly ConditionalOrderView[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lastTime = useRef<number | undefined>(undefined);
  const firstTime = useRef<number | undefined>(undefined);
  const visiblePosition = position?.symbol === symbol ? position : undefined;
  const visibleOrders = useMemo(
    () => orders?.filter((order) => order.symbol === symbol) ?? [],
    [orders, symbol],
  );
  const visibleTriggers = useMemo(
    () => triggers?.filter((trigger) => trigger.symbol === symbol) ?? [],
    [triggers, symbol],
  );
  useEffect(() => {
    if (!container.current) return;
    const colors = getComputedStyle(container.current);
    chart.current = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: colors.getPropertyValue('--canvas').trim() },
        textColor: colors.getPropertyValue('--muted').trim(),
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 10,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: colors.getPropertyValue('--line').trim() },
        horzLines: { color: colors.getPropertyValue('--line').trim() },
      },
      rightPriceScale: { borderVisible: false, minimumWidth: 58 },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: {
        vertLine: { labelBackgroundColor: '#32363e' },
        horzLine: { labelBackgroundColor: '#32363e' },
      },
      handleScroll: { vertTouchDrag: false },
    });
    series.current = chart.current.addSeries(CandlestickSeries, {
      upColor: colors.getPropertyValue('--up').trim(),
      downColor: colors.getPropertyValue('--down').trim(),
      wickUpColor: colors.getPropertyValue('--up').trim(),
      wickDownColor: colors.getPropertyValue('--down').trim(),
      borderVisible: false,
    });
    return () => {
      chart.current?.remove();
      chart.current = null;
      series.current = null;
      lastTime.current = undefined;
      firstTime.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (!series.current || !bars.length) return;
    const mapped = bars.map(({ time, open, high, low, close }) => ({
      time: time as UTCTimestamp,
      open,
      high,
      low,
      close,
    }));
    // Refresh the full exchange window, preserving the user's zoom after initial load.
    series.current.setData(mapped);
    const minPrice = Math.min(...bars.map((bar) => bar.low));
    const precision = Math.max(2, Math.min(10, 4 - Math.floor(Math.log10(minPrice))));
    series.current.applyOptions({
      priceFormat: { type: 'price', precision, minMove: 10 ** -precision },
    });
    if (
      !lastTime.current ||
      (bars[0]?.time !== firstTime.current && bars.at(-1)!.time < lastTime.current)
    ) {
      chart.current
        ?.timeScale()
        .setVisibleLogicalRange({ from: Math.max(0, bars.length - 60), to: bars.length + 3 });
    }
    lastTime.current = bars.at(-1)?.time;
    firstTime.current = bars[0]?.time;
  }, [bars]);
  const entryPrice = visiblePosition?.entryPrice;
  const side = visiblePosition?.side;
  useEffect(() => {
    const currentSeries = series.current;
    if (!currentSeries || !container.current) return;
    // Include account price levels when autoscaling, without resetting time zoom.
    const prices = [
      ...(entryPrice ? [entryPrice] : []),
      ...visibleOrders.map((order) => order.price),
      ...visibleTriggers.map((trigger) => trigger.price),
    ];
    currentSeries.applyOptions({
      autoscaleInfoProvider: prices.length
        ? (original: () => AutoscaleInfo | null) => {
            const range = original();
            if (range?.priceRange) {
              range.priceRange.minValue = Math.min(range.priceRange.minValue, ...prices);
              range.priceRange.maxValue = Math.max(range.priceRange.maxValue, ...prices);
            }
            return range;
          }
        : undefined,
    });
    const colors = getComputedStyle(container.current);
    const lines: IPriceLine[] = [];
    if (entryPrice && side)
      lines.push(
        currentSeries.createPriceLine({
          price: entryPrice,
          color: colors.getPropertyValue(side === 'Long' ? '--up' : '--down').trim(),
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${side} entry`,
        }),
      );
    for (const order of visibleOrders)
      lines.push(
        currentSeries.createPriceLine({
          price: order.price,
          color: colors.getPropertyValue(order.side === 'Buy' ? '--up' : '--down').trim(),
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${order.side} ${order.reduceOnly ? 'reduce' : 'limit'} · ${order.remaining}`,
        }),
      );
    for (const trigger of visibleTriggers)
      lines.push(
        currentSeries.createPriceLine({
          price: trigger.price,
          color: colors.getPropertyValue(trigger.kind === 'TP' ? '--up' : '--down').trim(),
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `${trigger.kind} trigger`,
        }),
      );
    return () => {
      if (series.current === currentSeries)
        lines.forEach((line) => currentSeries.removePriceLine(line));
    };
  }, [entryPrice, side, visibleOrders, visibleTriggers]);
  return (
    <>
      {visiblePosition && (
        <div className="chart-position" aria-label="Current position">
          <span title="Average entry price of your current net position">
            {visiblePosition.side} · <span className="chart-entry-label">Entry </span>
            {price(visiblePosition.entryPrice)}
          </span>
          <strong
            className={visiblePosition.pnlTone}
            title="Unrealized mark-price P&L, before fees and funding"
          >
            <span className="chart-pnl-label">P&L </span>
            {pnl(visiblePosition.unrealizedPnl)} USDC
          </strong>
        </div>
      )}
      <div
        className={`candle-canvas${visiblePosition ? ' with-position' : ''}`}
        ref={container}
        role="img"
        aria-label={`${symbol} candlestick chart from Phoenix. ${bars.length} price candles.${visiblePosition ? ` ${visiblePosition.side} average entry ${price(visiblePosition.entryPrice)}. Unrealized P&L ${pnl(visiblePosition.unrealizedPnl)} USDC, before fees and funding.` : ''}${visibleOrders.map((order) => ` ${order.side} limit ${order.remaining} ${symbol} at ${price(order.price)} USD${order.reduceOnly ? ', reduce only' : ''}.`).join('')}${visibleTriggers.map((trigger) => ` ${trigger.kind} trigger at ${price(trigger.price)} USD.`).join('')}`}
      />
    </>
  );
}

function ExpandedChart({
  symbol,
  timeframe,
  setTimeframe,
  collapse,
  position,
  orders,
  triggers,
}: {
  symbol: string;
  timeframe: Timeframe;
  setTimeframe: (value: Timeframe) => void;
  collapse: () => void;
  position?: PositionView;
  orders?: readonly OpenOrderView[];
  triggers?: readonly ConditionalOrderView[];
}) {
  const { bars, loading, error, retry } = useCandles(symbol, timeframe);
  return (
    <>
      <div className="chart-toolbar">
        <div className="timeframe-list" aria-label="Chart timeframe">
          {timeframes.map((value) => (
            <button
              key={value}
              aria-pressed={timeframe === value}
              onClick={() => setTimeframe(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="Collapse chart"
          aria-expanded="true"
          onClick={collapse}
        >
          <ChevronDown size={20} />
        </button>
      </div>
      <div className="chart-plot">
        {bars.length > 0 && (
          <CandleCanvas
            key={`${symbol}:${timeframe}`}
            bars={bars}
            symbol={symbol}
            position={position}
            orders={orders}
            triggers={triggers}
          />
        )}
        {loading && (
          <div className="chart-message" role="status">
            Loading Phoenix candles…
          </div>
        )}
        {!loading && !bars.length && (
          <div className="chart-message">
            <span>{error ? 'Candles unavailable' : 'No candles for this timeframe'}</span>
            <button className="text-button" onClick={retry}>
              Retry
            </button>
          </div>
        )}
        {!!bars.length && error && (
          <div className="chart-warning" role="status">
            Last refresh failed · <button onClick={retry}>Retry</button>
          </div>
        )}
      </div>
    </>
  );
}

export function ChartDock({
  symbol,
  expanded,
  onToggle,
  timeframe,
  setTimeframe,
  position,
  orders,
  triggers,
}: {
  symbol: string;
  expanded: boolean;
  onToggle: () => void;
  timeframe: Timeframe;
  setTimeframe: (value: Timeframe) => void;
  position?: PositionView;
  orders?: readonly OpenOrderView[];
  triggers?: readonly ConditionalOrderView[];
}) {
  return (
    <section className={`chart-dock ${expanded ? 'chart-expanded' : ''}`} aria-label="Price chart">
      {expanded ? (
        <ExpandedChart
          symbol={symbol}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          collapse={onToggle}
          position={position}
          orders={orders}
          triggers={triggers}
        />
      ) : (
        <button className="chart-opener" aria-expanded="false" onClick={onToggle}>
          <span>
            <CandlestickChart size={18} />
            {symbol} / USDC chart
          </span>
          <ChevronUp size={20} />
        </button>
      )}
    </section>
  );
}
