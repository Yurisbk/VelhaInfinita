import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';
import { Cell as CellType } from '../utils/gameLogic';

interface CellProps {
  value: CellType;
  index: number;
  isFading: boolean;
  isWinning: boolean;
  onClick: (index: number) => void;
  disabled: boolean;
}

const PIECE = {
  X: {
    text: '#67e8f9',   // cyan-300
    glow: '0 0 18px rgba(103, 232, 249, 0.85), 0 0 40px rgba(103, 232, 249, 0.4)',
    border: 'rgba(103, 232, 249, 0.45)',
    bg: 'rgba(103, 232, 249, 0.07)',
  },
  O: {
    text: '#f9a8d4',   // pink-300
    glow: '0 0 18px rgba(249, 168, 212, 0.85), 0 0 40px rgba(249, 168, 212, 0.4)',
    border: 'rgba(249, 168, 212, 0.45)',
    bg: 'rgba(249, 168, 212, 0.07)',
  },
} as const;

const FADING_GLOW =
  '0 0 22px rgba(251, 146, 60, 0.9), 0 0 50px rgba(251, 146, 60, 0.5)';

export default function Cell({
  value,
  index,
  isFading,
  isWinning,
  onClick,
  disabled,
}: CellProps) {
  const controls = useAnimation();
  const isEmpty = value === null;
  const cfg = value ? PIECE[value] : null;

  // Pulse effect when cell becomes the fading target
  useEffect(() => {
    if (isFading && value) {
      controls.start({
        scale: [1, 1.08, 1, 1.06, 1],
        transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
      });
    } else {
      controls.stop();
      controls.set({ scale: 1 });
    }
  }, [isFading, value, controls]);

  const cellBg = isWinning
    ? 'rgba(250, 204, 21, 0.12)'
    : cfg
      ? (isFading ? 'rgba(251, 146, 60, 0.10)' : cfg.bg)
      : 'transparent';

  const cellBorder = isWinning
    ? '#facc15'
    : isFading
      ? '#fb923c'
      : cfg
        ? cfg.border
        : 'rgba(255,255,255,0.10)';

  return (
    <motion.button
      className="relative aspect-square flex items-center justify-center rounded-2xl cursor-pointer select-none transition-colors duration-200 border-2 focus:outline-none overflow-hidden"
      style={{
        background: cellBg,
        borderColor: cellBorder,
        borderStyle: isFading && !isWinning ? 'dashed' : 'solid',
        boxShadow: isWinning
          ? '0 0 20px rgba(250, 204, 21, 0.5)'
          : isFading && value
            ? FADING_GLOW
            : 'none',
      }}
      onClick={() => onClick(index)}
      disabled={disabled || !isEmpty}
      whileHover={isEmpty && !disabled ? { scale: 1.06, borderColor: 'rgba(255,255,255,0.3)' } : {}}
      whileTap={isEmpty && !disabled ? { scale: 0.94 } : {}}
      aria-label={value ? `Célula ${index + 1}: ${value}` : `Célula ${index + 1}: vazia`}
    >
      {value && (
        <motion.span
          animate={controls}
          initial={{ scale: 0, rotate: -15 }}
          className="font-black leading-none select-none"
          style={{
            fontSize: 'clamp(1.8rem, 8vw, 2.6rem)',
            color: isFading ? '#fb923c' : cfg!.text,
            textShadow: isFading
              ? FADING_GLOW
              : cfg!.glow,
            filter: isFading ? 'brightness(1.2)' : 'brightness(1)',
            transition: 'color 0.25s, text-shadow 0.25s',
          }}
        >
          {value}
        </motion.span>
      )}

      {isFading && value && (
        <motion.span
          className="absolute text-[10px] font-bold tracking-wide"
          style={{ color: '#fb923c', bottom: 4, right: 6, opacity: 0.85 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          vai sumir
        </motion.span>
      )}
    </motion.button>
  );
}
