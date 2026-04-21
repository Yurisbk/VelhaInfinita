import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Perfil from './pages/Perfil';
import LocalGame from './pages/LocalGame';
import CPUGame from './pages/CPUGame';
import OnlineGame from './pages/OnlineGame';
import QuickMatch from './pages/QuickMatch';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <div className="min-h-screen bg-dark">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/login" element={<Perfil />} />
            <Route path="/local" element={<LocalGame />} />
            <Route path="/cpu" element={<CPUGame />} />
            <Route path="/online" element={<OnlineGame />} />
            <Route path="/partida-rapida" element={<QuickMatch />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </div>
      </PlayerProvider>
    </BrowserRouter>
  );
}
