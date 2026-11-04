// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Trade } from './Trade';

const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  stale: false,
  positionLots: '1',
}));
vi.mock('./market-data', () => ({
  timeframes: ['1h'],
  useMarkets: () => ({
    markets: [
      {
        symbol: 'ETH',
        baseLotsDecimals: 3,
        leverageTiers: [{ maxLeverage: 25 }],
        marketStatus: 'active',
        isolatedOnly: false,
      },
    ],
    error: '',
    retry: vi.fn(),
  }),
  useOrderBook: () => ({
    stale: false,
    book: { bids: [[2329, 1]], asks: [[2330, 1]] },
    error: '',
    retry: vi.fn(),
  }),
}));
vi.mock('../wallet/session', () => ({
  useWalletSession: () => ({
    ready: true,
    configured: true,
    authenticated: true,
    selected: 'wallet',
  }),
}));
vi.mock('../trading/service', () => ({ availableOrderSize: () => '0' }));
vi.mock('../trading/state', () => ({
  useTrading: () => ({
    stale: mocks.stale,
    busy: false,
    review: mocks.review,
    account: {
      authority: 'wallet',
      registered: true,
      freeMargin: 2_000_000n,
      subaccount: {
        capabilities: { state: 'active' },
        positions: [
          { symbol: 'ETH', basePositionLots: mocks.positionLots, entryPriceTicks: '23200' },
        ],
        orders: [
          {
            symbol: 'ETH',
            orders: [
              {
                orderSequenceNumber: 'order-7',
                side: 'bid',
                orderType: 'limit',
                priceTicks: '23000',
                sizeRemainingLots: '1',
                initialSizeLots: '1',
                reduceOnly: false,
                status: 'open',
                isConditionalOrder: false,
              },
            ],
          },
        ],
      },
      margin: {
        marketMargins: [
          {
            symbol: 'ETH',
            basePositionLots: mocks.positionLots,
            entryPriceTicks: '23200',
            unrealizedPnlQuoteLots: '1000',
          },
        ],
      },
      params: {
        paramsBySymbol: { ETH: { tickSize: '100', baseLotDecimals: 3, markPriceTicks: '23300' } },
      },
      conditionals: [
        {
          index: 3,
          sequence: 'conditional-9',
          symbol: 'ETH',
          takeProfit: '2400',
          stopLoss: '2250',
        },
      ],
    },
  }),
}));
vi.mock('./components/CandleChart', () => ({ ChartDock: () => null }));
vi.mock('./components/Sheet', () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
async function render() {
  await act(() =>
    root.render(
      <Trade
        symbol="ETH"
        onSelect={vi.fn()}
        chartOpen={false}
        toggleChart={vi.fn()}
        timeframe="1h"
        setTimeframe={vi.fn()}
        openFunding={vi.fn()}
      />,
    ),
  );
}
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === label);
  expect(button).toBeTruthy();
  await act(() => button!.click());
}
beforeEach(() => {
  mocks.stale = false;
  mocks.positionLots = '1';
});
afterEach(async () => {
  await act(() => root.render(null));
  vi.clearAllMocks();
});
it('includes limit and paired TP/SL orders in Orders and routes cancellation to the exact selected order', async () => {
  await render();
  await click('Orders (3)');
  const limit = container.querySelector('[aria-label="ETH buy limit order"]')!;
  const tp = container.querySelector('[aria-label="ETH TP order"]')!;
  const sl = container.querySelector('[aria-label="ETH SL order"]')!;
  expect(limit).toBeTruthy();
  expect(tp.textContent).toContain('Take profit trigger2,400.00 USD');
  expect(tp.textContent).not.toContain('Stop loss');
  expect(sl.textContent).toContain('Stop loss trigger2,250.00 USD');
  expect(sl.textContent).not.toContain('Take profit');
  expect(mocks.review).not.toHaveBeenCalled();
  await act(() => tp.querySelector('button')!.click());
  expect(mocks.review).toHaveBeenLastCalledWith({
    kind: 'cancelConditional',
    symbol: 'ETH',
    index: 3,
    sequence: 'conditional-9',
    leg: 'TP',
  });
  await act(() => sl.querySelector('button')!.click());
  expect(mocks.review).toHaveBeenLastCalledWith({
    kind: 'cancelConditional',
    symbol: 'ETH',
    index: 3,
    sequence: 'conditional-9',
    leg: 'SL',
  });
  await act(() => limit.querySelector('button')!.click());
  expect(mocks.review).toHaveBeenLastCalledWith({
    kind: 'cancel',
    symbol: 'ETH',
    sequence: 'order-7',
    priceTicks: '23000',
  });
});
it.each([
  ['1', 'short'],
  ['-1', 'long'],
] as const)('closes position lots %s with the opposite reduce-only side', async (lots, side) => {
  mocks.positionLots = lots;
  await render();
  expect(container.querySelector('article')?.textContent).toContain('Position size0.001 ETH');
  await click('Close position');
  expect(mocks.review).toHaveBeenCalledExactlyOnceWith({
    kind: 'order',
    symbol: 'ETH',
    side,
    orderType: 'market',
    baseUnits: '0.001',
    reduceOnly: true,
  });
});
it('disables position and order actions while account state is stale', async () => {
  mocks.stale = true;
  await render();
  expect(
    container.querySelector('article .trade-card-footer button')?.hasAttribute('disabled'),
  ).toBe(true);
  await click('Orders (3)');
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('article button')];
  expect(buttons).toHaveLength(3);
  expect(buttons.every((button) => button.disabled)).toBe(true);
  expect(mocks.review).not.toHaveBeenCalled();
});

async function fill(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  expect(input).toBeTruthy();
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it('normalizes decimal commas in order size, limit price and TP/SL before review', async () => {
  await render();
  await click('Market');
  const limit = [...container.querySelectorAll<HTMLButtonElement>('.choice-row')].find((button) =>
    button.textContent?.startsWith('Limit order'),
  )!;
  await act(() => limit.click());
  await fill('[placeholder="Limit price"]', '2300,1');
  await fill('#order-amount', '0,001');
  await act(() => container.querySelector<HTMLInputElement>('.tpsl-toggle input')!.click());
  await fill('[aria-label="Take profit price"]', '2400,2');
  await fill('[aria-label="Stop loss price"]', '2200,3');
  await click('Open Long');
  expect(mocks.review).toHaveBeenCalledWith(
    expect.objectContaining({
      baseUnits: '0.001',
      limitPrice: '2300.1',
      takeProfit: '2400.2',
      stopLoss: '2200.3',
    }),
    expect.any(Function),
  );
});
it('clears quantity, total and TP/SL only after the submitted ticket confirms', async () => {
  await render();
  await fill('#order-amount', '0.001');
  await act(() => container.querySelector<HTMLInputElement>('.tpsl-toggle input')!.click());
  await fill('[aria-label="Take profit price"]', '2400');
  await fill('[aria-label="Stop loss price"]', '2200');
  await click('Open Long');
  expect(mocks.review).toHaveBeenCalledWith(
    expect.objectContaining({ baseUnits: '0.001', takeProfit: '2400', stopLoss: '2200' }),
    expect.any(Function),
  );
  expect(container.querySelector<HTMLInputElement>('#order-amount')!.value).toBe('0.001');
  expect(container.querySelector('.notional-estimate')?.textContent).toContain('2.33');
  await act(() => mocks.review.mock.calls[0]![1]());
  expect(container.querySelector<HTMLInputElement>('#order-amount')!.value).toBe('');
  expect(container.querySelector('.notional-estimate')?.textContent).toContain('—');
  expect(container.querySelector<HTMLInputElement>('.tpsl-toggle input')!.checked).toBe(false);
  await act(() => container.querySelector<HTMLInputElement>('.tpsl-toggle input')!.click());
  expect(container.querySelector<HTMLInputElement>('[aria-label="Take profit price"]')!.value).toBe(
    '',
  );
  expect(container.querySelector<HTMLInputElement>('[aria-label="Stop loss price"]')!.value).toBe(
    '',
  );
});
it('shows the rounded quantity and value that will actually reach review for a USDC input', async () => {
  await render();
  await act(() => container.querySelector<HTMLButtonElement>('.unit-selector')!.click());
  await click('USDC · order value');
  await fill('#order-amount', '10');
  const estimate = container.querySelector('.notional-estimate')!;
  expect(estimate.textContent).toContain('Est. order value');
  expect(estimate.textContent).toContain('9.32');
  expect(estimate.textContent).toContain('0.004 ETH');
  expect(estimate.textContent).toContain('Rounded down to 0.001 ETH steps.');
  expect(container.querySelector<HTMLInputElement>('#order-amount')!.value).toBe('10');
  await click('Open Long');
  expect(mocks.review).toHaveBeenCalledWith(
    expect.objectContaining({ baseUnits: '0.004' }),
    expect.any(Function),
  );
  await fill('#order-amount', '9.32');
  expect(estimate.textContent).not.toContain('Rounded down');
});
it('does not clear a newer draft when an earlier order confirms', async () => {
  await render();
  await fill('#order-amount', '0.001');
  await click('Open Long');
  const confirmed = mocks.review.mock.calls[0]![1];
  await fill('#order-amount', '0.002');
  await act(() => confirmed());
  expect(container.querySelector<HTMLInputElement>('#order-amount')!.value).toBe('0.002');
});
