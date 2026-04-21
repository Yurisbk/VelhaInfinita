import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

interface PlayerContextValue {
  playerName: string;
  setPlayerName: (name: string) => void;
  hasConsented: boolean;
  giveConsent: (name: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const COOKIE_PLAYER = 'ttt_player';
const COOKIE_CONSENT = 'ttt_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerNameState] = useState<string>('');
  const [hasConsented, setHasConsented] = useState<boolean>(false);

  useEffect(() => {
    const consent = getCookie(COOKIE_CONSENT);
    const name = getCookie(COOKIE_PLAYER);
    if (consent === 'true') {
      setHasConsented(true);
      setPlayerNameState(name ?? '');
    }
  }, []);

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    if (hasConsented) {
      setCookie(COOKIE_PLAYER, name, COOKIE_MAX_AGE);
    }
  }, [hasConsented]);

  const giveConsent = useCallback((name: string) => {
    setCookie(COOKIE_CONSENT, 'true', COOKIE_MAX_AGE);
    setCookie(COOKIE_PLAYER, name, COOKIE_MAX_AGE);
    setHasConsented(true);
    setPlayerNameState(name);
  }, []);

  return (
    <PlayerContext.Provider value={{ playerName, setPlayerName, hasConsented, giveConsent }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer deve ser usado dentro de PlayerProvider');
  return ctx;
}
