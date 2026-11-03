import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { PrivyRoot } from './PrivyRoot';
import { resolveAppWallet } from './app-wallet';

function WalletInspector() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const [error, setError] = useState('');
  const selected = resolveAppWallet({ ready, authenticated, user, walletsReady, wallets });

  async function endSession() {
    setError('');
    try {
      await logout();
    } catch {
      setError('Logout did not complete. Retry before leaving a shared device.');
    }
  }

  if (!ready) return <p role="status">Preparing Privy…</p>;
  if (!authenticated)
    return (
      <>
        <p>
          Provider configured. Login and wallet recovery have not been verified by configuration
          alone.
        </p>
        <button onClick={() => login({ loginMethods: ['email'] })}>Log in with email</button>
        {error && <p role="alert">{error}</p>}
      </>
    );

  return (
    <>
      <p>
        Session authenticated.{' '}
        {walletsReady ? `${wallets.length} connected Solana wallet(s).` : 'Discovering wallets…'}
      </p>
      <ul className="wallets">
        {wallets.map((wallet) => (
          <li key={wallet.address}>
            <p>
              <span className="address">{wallet.address}</span>
              {selected?.address === wallet.address ? ' · App wallet' : ' · Other connected wallet'}
            </p>
          </li>
        ))}
      </ul>
      {selected ? (
        <p className="address">
          App wallet authority: <code>{selected.address}</code>. No signing capability is invoked
          here.
        </p>
      ) : (
        <p>Waiting for your Privy app wallet to connect automatically.</p>
      )}
      <div className="actions">
        <button onClick={() => void endSession()}>Log out</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export default function PrivyWalletLab() {
  return (
    <PrivyRoot>
      <WalletInspector />
    </PrivyRoot>
  );
}
