// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CandleCanvas } from './CandleChart';
import type { OpenOrderView } from '../../trading/order-view';

const mocks = vi.hoisted(() => ({
  line: vi.fn(),
  removeLine: vi.fn(),
  options: vi.fn(),
  removeChart: vi.fn(),
}));
vi.mock('lightweight-charts', () => ({
  CandlestickSeries: {},
  ColorType: { Solid: 'solid' },
  LineStyle: { Dashed: 2, Dotted: 1, LargeDashed: 3 },
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      applyOptions: mocks.options,
      createPriceLine: mocks.line,
      removePriceLine: mocks.removeLine,
    }),
    timeScale: () => ({ setVisibleLogicalRange: vi.fn() }),
    remove: mocks.removeChart,
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
const order: OpenOrderView = {
  id: 'ETH:1',
  symbol: 'ETH',
  side: 'Buy',
  price: 2300,
  markPrice: 2325,
  remaining: '0.001',
  filled: '0',
  reduceOnly: false,
  sequence: '1',
  priceTicks: '23000',
};
const position = {
  symbol: 'ETH',
  side: 'Long' as const,
  entryPrice: 2310,
  markPrice: 2325,
  unrealizedPnl: '0.1',
  pnlTone: 'positive' as const,
};
afterEach(async () => {
  await act(() => root.render(null));
  vi.clearAllMocks();
});
it('draws a resting order separately from the filled position and includes both in the price range', async () => {
  await act(() =>
    root.render(<CandleCanvas symbol="ETH" bars={[]} position={position} orders={[order]} />),
  );
  expect(mocks.line.mock.calls.map(([line]) => ({ price: line.price, title: line.title }))).toEqual(
    [
      { price: 2310, title: 'Long entry' },
      { price: 2300, title: 'Buy limit · 0.001' },
    ],
  );
  const autoscale = mocks.options.mock.calls.find(([options]) => options.autoscaleInfoProvider)?.[0]
    .autoscaleInfoProvider;
  expect(autoscale(() => ({ priceRange: { minValue: 2320, maxValue: 2330 } })).priceRange).toEqual({
    minValue: 2300,
    maxValue: 2330,
  });
  expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
    'Buy limit 0.001 ETH at 2,300.00',
  );
});
it('removes an order line on cancellation while retaining the current position', async () => {
  mocks.line.mockImplementation((options) => ({ ...options }));
  await act(() =>
    root.render(<CandleCanvas symbol="ETH" bars={[]} position={position} orders={[order]} />),
  );
  await act(() =>
    root.render(<CandleCanvas symbol="ETH" bars={[]} position={position} orders={[]} />),
  );
  expect(mocks.removeLine).toHaveBeenCalledWith(expect.objectContaining({ price: 2300 }));
  expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).not.toContain(
    'Buy limit',
  );
  expect(container.textContent).toContain('Entry');
});
it('does not draw another market’s order', async () => {
  await act(() => root.render(<CandleCanvas symbol="BTC" bars={[]} orders={[order]} />));
  expect(mocks.line).not.toHaveBeenCalled();
});
it('draws sell limits and short entries as well as buy limits and long entries', async () => {
  await act(() =>
    root.render(
      <CandleCanvas
        symbol="ETH"
        bars={[]}
        position={{ ...position, side: 'Short' }}
        orders={[{ ...order, side: 'Sell' }]}
      />,
    ),
  );
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({ price: 2310, title: 'Short entry' }),
  );
  expect(mocks.line).toHaveBeenCalledWith(
    expect.objectContaining({ price: 2300, title: 'Sell limit · 0.001' }),
  );
});
it('draws distinct TP/SL triggers, includes them in the scale, and filters other markets', async () => {
  await act(() =>
    root.render(
      <CandleCanvas
        symbol="ETH"
        bars={[]}
        triggers={[
          { id: 'tp', symbol: 'ETH', kind: 'TP', price: 2400 },
          { id: 'sl', symbol: 'ETH', kind: 'SL', price: 2250 },
          { id: 'other', symbol: 'SOL', kind: 'TP', price: 100 },
        ]}
      />,
    ),
  );
  expect(mocks.line.mock.calls.map(([line]) => ({ price: line.price, title: line.title }))).toEqual(
    [
      { price: 2400, title: 'TP trigger' },
      { price: 2250, title: 'SL trigger' },
    ],
  );
  const autoscale = mocks.options.mock.calls.find(([options]) => options.autoscaleInfoProvider)?.[0]
    .autoscaleInfoProvider;
  expect(autoscale(() => ({ priceRange: { minValue: 2320, maxValue: 2330 } })).priceRange).toEqual({
    minValue: 2250,
    maxValue: 2400,
  });
  expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
    'TP trigger at 2,400.00 USD. SL trigger at 2,250.00 USD.',
  );
});
it('removes canceled TP/SL lines and restores the normal price range', async () => {
  mocks.line.mockImplementation((options) => ({ ...options }));
  await act(() =>
    root.render(
      <CandleCanvas
        symbol="ETH"
        bars={[]}
        triggers={[{ id: 'tp', symbol: 'ETH', kind: 'TP', price: 2400 }]}
      />,
    ),
  );
  await act(() => root.render(<CandleCanvas symbol="ETH" bars={[]} triggers={[]} />));
  expect(mocks.removeLine).toHaveBeenCalledWith(expect.objectContaining({ price: 2400 }));
  expect(mocks.options).toHaveBeenLastCalledWith({ autoscaleInfoProvider: undefined });
  expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).not.toContain(
    'TP trigger',
  );
});
