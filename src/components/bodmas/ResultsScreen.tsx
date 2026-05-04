import { motion } from 'framer-motion'
import type { StandardDifficulty } from '../../types/game'

interface ResultsScreenProps {
  score: number
  totalQuestions: number
  difficulty: StandardDifficulty
  onBackToMenu: () => void
}

export function ResultsScreen({
  score,
  totalQuestions,
  difficulty,
  onBackToMenu,
}: ResultsScreenProps) {
  const percentage = Math.round((score / totalQuestions) * 100)

  let message = ''
  let emoji = ''
  let color = ''

  if (percentage === 100) {
    message = 'PERFECT! You are a BODMAS Master! 🌟'
    emoji = '⭐'
    color = 'from-yellow-300 to-yellow-400'
  } else if (percentage >= 80) {
    message = 'Amazing! You rock! 🎉'
    emoji = '🎊'
    color = 'from-green-400 to-green-500'
  } else if (percentage >= 60) {
    message = 'Great job! Keep practicing! 💪'
    emoji = '👏'
    color = 'from-blue-400 to-blue-500'
  } else if (percentage >= 40) {
    message = 'Good effort! Try again! 🔄'
    emoji = '💭'
    color = 'from-orange-400 to-orange-500'
  } else {
    message = 'Keep learning! You can do it! 🚀'
    emoji = '🌱'
    color = 'from-pink-400 to-pink-500'
  }

  const difficultyLabel = difficulty.toUpperCase() + ' Level'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-300 via-yellow-200 to-green-200 p-4 flex flex-col items-center justify-center">
      {/* Animated confetti background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 1, y: -100, x: Math.random() * 400 - 200 }}
            animate={{ opacity: 0, y: 400 }}
            transition={{
              duration: 2 + Math.random() * 1,
              delay: i * 0.1,
              repeat: Infinity,
            }}
            className="absolute text-4xl"
          >
            {['🎉', '🎊', '⭐', '🌟', '✨'][i % 5]}
          </motion.div>
        ))}
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-br from-amber-700 to-amber-900 p-12 rounded-3xl shadow-2xl border-8 border-amber-950 max-w-2xl w-full relative z-10"
      >
        {/* Score Badge */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="text-center mb-8"
        >
          <div className="text-8xl mb-4">{emoji}</div>
          <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-3">
            {message}
          </h1>
        </motion.div>

        {/* Score Details */}
        <div className="bg-white bg-opacity-95 rounded-2xl p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {difficultyLabel} Level
            </h2>
            <p className="text-gray-600 text-lg">Your Performance</p>
          </div>

          {/* Score Display */}
          <div className="text-center mb-6">
            <motion.div
              key={score}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`
                text-7xl font-bold mb-2
                bg-gradient-to-r ${color}
                bg-clip-text text-transparent
              `}
            >
              {score}/{totalQuestions}
            </motion.div>
            <p className="text-3xl font-bold text-gray-800">{percentage}%</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-300 rounded-full h-8 overflow-hidden border-3 border-gray-400">
              <motion.div
                className={`bg-gradient-to-r ${color} h-full`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>

          {/* Encouragement */}
          <p className="text-center text-gray-700 text-lg font-semibold">
            {percentage === 100
              ? '🏆 You are a true BODMAS Master!'
              : '💪 Great effort! Practice makes perfect!'}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBackToMenu}
            className="w-full bg-gradient-to-b from-blue-400 to-blue-500 text-white text-2xl font-bold py-6 rounded-2xl
              border-4 border-blue-600 shadow-lg hover:shadow-xl transition-all"
          >
            🏠 Back to Menu
          </motion.button>
        </div>
      </motion.div>

      {/* Side mascots */}
      <div className="absolute left-4 bottom-16 text-7xl animate-bounce">🐼</div>
      <div className="absolute right-4 bottom-16 text-7xl animate-pulse">🐰</div>
    </div>
  )
}
