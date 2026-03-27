import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  scale: number;
}

interface ConfettiProps {
  isActive: boolean;
}

const COLORS = [
  'hsl(162, 73%, 46%)', // Primary green
  'hsl(200, 95%, 55%)', // Blue
  'hsl(280, 65%, 55%)', // Purple
  '#FFD700', // Gold
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
];

const Confetti = ({ isActive }: ConfettiProps) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (isActive) {
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.3,
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
      }));
      setPieces(newPieces);
    } else {
      setPieces([]);
    }
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute"
              style={{
                left: `${piece.x}%`,
                top: -20,
              }}
              initial={{ 
                y: -20, 
                opacity: 1, 
                rotate: piece.rotation,
                scale: piece.scale 
              }}
              animate={{ 
                y: window.innerHeight + 100,
                opacity: [1, 1, 0],
                rotate: piece.rotation + 720,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.5 + Math.random(),
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              {/* Randomly choose between rectangle, circle, or triangle */}
              {piece.id % 3 === 0 ? (
                <div
                  className="w-3 h-4 rounded-sm"
                  style={{ backgroundColor: piece.color }}
                />
              ) : piece.id % 3 === 1 ? (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: piece.color }}
                />
              ) : (
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: `10px solid ${piece.color}`,
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default Confetti;
