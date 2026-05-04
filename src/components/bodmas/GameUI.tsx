import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface GameUIProps {
  question: string
  score: number
  currentQuestion: number
  totalQuestions: number
  children?: ReactNode
}

export function GameUI({
  question,
  score,
  currentQuestion,
  totalQuestions,
  children,
}: GameUIProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-300 via-yellow-200 to-green-200 p-4 flex flex-col items-center justify-center">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-10 left-10 text-6xl"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          🌞
        </motion.div>
        <motion.div
          className="absolute top-24 right-16 text-5xl"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          🦋
        </motion.div>
        <motion.div
          className="absolute top-1/2 right-5 text-5xl"
          animate={{ x: [0, 10, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          🐢
        </motion.div>
      </div>

      {/* Top Score and Progress Bar */}
      <div className="w-full max-w-2xl mb-6 relative z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="text-2xl font-bold text-white drop-shadow-lg">
            Score: <span className="text-yellow-300">{score}</span>
          </div>
          <div className="text-lg font-bold text-white drop-shadow-lg">
            Question {currentQuestion} / {totalQuestions}
          </div>
        </div>
        <div className="w-full bg-gray-400 rounded-full h-6 overflow-hidden border-4 border-gray-700 shadow-lg">
          <motion.div
            className="bg-gradient-to-r from-green-400 to-blue-500 h-full"
            initial={{ width: 0 }}
            animate={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Blackboard */}
      <motion.div
        className="relative w-full max-w-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Wooden Frame */}
        <div className="bg-gradient-to-b from-amber-700 to-amber-900 p-6 rounded-3xl shadow-2xl border-8 border-amber-950">
          {/* Blackboard Surface */}
          <div className="bg-gradient-to-br from-green-900 via-green-800 to-green-900 rounded-2xl p-8 shadow-inner border-4 border-green-950 relative">
            {/* Chalkboard texture overlay */}
            <div className="absolute inset-0 opacity-10 bg-black rounded-2xl pointer-events-none" />

            {/* Question area */}
            <div className="text-center mb-8 relative z-10">
              <h2 className="text-5xl md:text-6xl font-bold text-yellow-100 drop-shadow-lg font-sans tracking-wider">
                {question}
              </h2>
              <div className="h-1 bg-yellow-100 mt-4 rounded" />
            </div>

            {/* Answer options area */}
            <div className="relative z-10">{children}</div>
          </div>
        </div>
      </motion.div>

      {/* Side mascots */}
      <div className="absolute left-4 bottom-16 text-7xl animate-bounce">🐼</div>
      <div className="absolute right-4 bottom-16 text-7xl animate-pulse">🐰</div>
    </div>
  )
}
