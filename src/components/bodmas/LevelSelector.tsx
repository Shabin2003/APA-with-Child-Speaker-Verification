import { motion } from 'framer-motion'
import type { StandardDifficulty } from '../../types/game'

interface LevelSelectorProps {
  onSelectLevel: (level: StandardDifficulty) => void
}

export function LevelSelector({ onSelectLevel }: LevelSelectorProps) {
  const levels: Array<{
    id: StandardDifficulty
    name: string
    emoji: string
    color: string
    description: string
  }> = [
    {
      id: 'easy',
      name: 'Easy',
      emoji: '🌱',
      color: 'from-green-400 to-green-500',
      description: 'Single operators',
    },
    {
      id: 'medium',
      name: 'Medium',
      emoji: '🔥',
      color: 'from-orange-400 to-red-500',
      description: 'Brackets & 2-3 operators',
    },
    {
      id: 'hard',
      name: 'Hard',
      emoji: '💎',
      color: 'from-purple-400 to-pink-500',
      description: 'Complex with multiple operations',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-300 via-yellow-200 to-green-200 p-4 flex flex-col items-center justify-center">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-10 left-10 text-7xl"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          🌞
        </motion.div>
        <motion.div
          className="absolute top-24 right-16 text-6xl"
          animate={{ y: [0, -30, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          🦋
        </motion.div>
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 relative z-10"
      >
        <h1 className="text-6xl md:text-7xl font-bold text-white drop-shadow-lg mb-2">
          🎮 BODMAS Master
        </h1>
        <p className="text-2xl text-white drop-shadow-lg">
          Learn math operations the fun way!
        </p>
      </motion.div>

      {/* Level Selection Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl relative z-10 mb-8"
      >
        {levels.map((level, idx) => (
          <motion.button
            key={level.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectLevel(level.id)}
            className={`
              bg-gradient-to-b ${level.color}
              text-white rounded-3xl p-8 shadow-xl hover:shadow-2xl
              transform transition-all border-4 border-yellow-300
              flex flex-col items-center justify-center
            `}
          >
            <div className="text-7xl mb-3">{level.emoji}</div>
            <h2 className="text-3xl font-bold mb-2">{level.name}</h2>
            <p className="text-lg font-semibold opacity-90">{level.description}</p>
          </motion.button>
        ))}
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-white bg-opacity-90 rounded-2xl p-6 max-w-2xl relative z-10 border-4 border-yellow-300"
      >
        <h3 className="text-2xl font-bold text-blue-600 mb-3">📚 How to Play:</h3>
        <ul className="text-lg text-gray-700 space-y-2 font-semibold">
          <li>✓ Solve each math problem using BODMAS rules</li>
          <li>✓ Tap Speak Answer and say your number clearly</li>
          <li>✓ Submit your spoken answer to check correctness</li>
          <li>✓ Complete all 10 questions to finish a level</li>
          <li>✓ If voice is unavailable, type your answer manually</li>
          <li>✓ Voice works best on Chrome, Edge, and Safari</li>
        </ul>
      </motion.div>

      {/* Side mascots */}
      <div className="absolute left-4 bottom-16 text-7xl animate-bounce">🐼</div>
      <div className="absolute right-4 bottom-16 text-7xl animate-pulse">🐰</div>
    </div>
  )
}
