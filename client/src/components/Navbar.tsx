import { Link } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

export default function Navbar() {
  const { playerName } = usePlayer();

  return (
    <nav className="bg-card/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          to="/"
          className="text-white font-black text-lg hover:text-primary transition-colors"
        >
          ♾️ Velha Infinita
        </Link>

        <div className="flex items-center gap-3">
          {playerName ? (
            <Link to="/perfil" className="text-white/60 text-sm hover:text-white transition-colors">
              Olá, <span className="text-white font-semibold">{playerName}</span>
            </Link>
          ) : (
            <Link to="/perfil" className="btn-ghost text-sm px-4 py-2">
              Definir apelido
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
