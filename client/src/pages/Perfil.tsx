import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';

export default function Perfil() {
  const { playerName, hasConsented, setPlayerName, giveConsent } = usePlayer();
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(playerName);
  const [showLGPD, setShowLGPD] = useState(!hasConsented);
  const [saved, setSaved] = useState(false);

  function handleConsent(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    giveConsent(trimmed);
    setShowLGPD(false);
    navigate('/');
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setPlayerName(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 py-12">
      <AnimatePresence mode="wait">
        {showLGPD ? (
          <motion.div
            key="lgpd"
            className="card w-full max-w-lg space-y-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-center">
              <span className="text-4xl">♾️</span>
              <h1 className="text-2xl font-black mt-2">Bem-vindo à Velha Infinita!</h1>
              <p className="text-white/60 text-sm mt-1">Antes de jogar, escolha como quer ser chamado.</p>
            </div>

            <form onSubmit={handleConsent} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Seu apelido</label>
                <input
                  type="text"
                  className="input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Como quer ser chamado?"
                  maxLength={20}
                  autoFocus
                  required
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 text-sm text-white/70">
                <p className="font-semibold text-white/90 flex items-center gap-2">
                  <span>🔒</span> Aviso de Privacidade (LGPD)
                </p>
                <p>
                  Ao jogar, coletamos os seguintes dados:
                </p>
                <ul className="list-disc list-inside space-y-1 text-white/60">
                  <li><strong className="text-white/80">Apelido:</strong> salvo em cookie no seu navegador por 7 dias para personalizar a experiência.</li>
                  <li><strong className="text-white/80">Endereço IP:</strong> registrado para fins de estatísticas anônimas de acesso e localização geográfica aproximada.</li>
                  <li><strong className="text-white/80">Cookies de sessão:</strong> utilizados exclusivamente para manter suas preferências locais.</li>
                </ul>
                <p className="text-white/50 text-xs">
                  Os dados são utilizados apenas para melhorar a experiência do jogo. Não compartilhamos informações pessoais com terceiros.
                  Base legal: consentimento (Art. 7º, I, LGPD). Você pode limpar os cookies a qualquer momento pelo seu navegador.
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={!nameInput.trim()}
              >
                Aceitar e Jogar
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="perfil"
            className="card w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h1 className="text-2xl font-black text-center">Meu Perfil</h1>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Seu apelido</label>
                <input
                  type="text"
                  className="input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Seu apelido"
                  maxLength={20}
                  required
                />
              </div>

              <AnimatePresence>
                {saved && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-green-400 text-sm text-center"
                  >
                    Salvo com sucesso!
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={!nameInput.trim() || nameInput.trim() === playerName}
              >
                Salvar
              </button>
            </form>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white/50 space-y-2">
              <p className="font-semibold text-white/70">Seus dados armazenados</p>
              <p>Apelido e preferências são salvos em cookies no seu navegador (7 dias). Para remover, limpe os cookies do site.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
