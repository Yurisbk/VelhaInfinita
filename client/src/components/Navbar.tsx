import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

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
          {user ? (
            <>
              <span className="text-white/60 text-sm hidden sm:inline">
                Olá, <span className="text-white font-semibold">{user.username}</span>
              </span>
              <button onClick={handleLogout} className="btn-ghost text-sm px-4 py-2">
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm px-4 py-2">
                Entrar
              </Link>
              <Link to="/register" className="btn-primary text-sm px-4 py-2">
                Cadastrar
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
