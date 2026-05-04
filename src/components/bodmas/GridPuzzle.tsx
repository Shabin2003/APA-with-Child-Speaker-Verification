import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GridPuzzle as GridPuzzleType, GridCell } from '../../types/game'

interface GridPuzzleProps {
  puzzles: GridPuzzleType[]
  onComplete: (score: number) => void
}

export function GridPuzzle({ puzzles, onComplete }: GridPuzzleProps) {
  const [currentPuzzleIdx, setCurrentPuzzleIdx] = useState(0)
  const [solved, setSolved] = useState(false)
  const [gridState, setGridState] = useState<GridCell[][]>([])
  const [lastCorrectCheck, setLastCorrectCheck] = useState<boolean | null>(null)

  const currentPuzzle = puzzles[currentPuzzleIdx]

  useEffect(() => {
    // Initialize grid state with empty strings for editable cells
    const initialState = currentPuzzle.grid.map((row) =>
      row.map((cell) => ({
        ...cell,
        value: cell.editable ? '' : cell.value,
      }))
    )
    setGridState(initialState)
    setSolved(false)
    setLastCorrectCheck(null)
  }, [currentPuzzleIdx, currentPuzzle])

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    // Only allow single characters for editable cells
    if (value.length > 1) return

    const newState = gridState.map((row) => [...row])
    newState[rowIdx][colIdx].value = value.toUpperCase()
    setGridState(newState)
  }

  const validatePuzzle = (): boolean => {
    // For now, simple validation - in production would need complex equation validation
    const isEmpty = gridState.some((row) =>
      row.some((cell) => cell.editable && cell.value === '')
    )

    if (isEmpty) {
      setLastCorrectCheck(false)
      return false
    }

    // TODO: Add actual mathematical validation of rows and columns
    setSolved(true)
    return true
  }

  const handleSubmit = () => {
    if (validatePuzzle()) {
      setTimeout(() => {
        if (
          currentPuzzleIdx + 1 < puzzles.length
        ) {
          setCurrentPuzzleIdx(currentPuzzleIdx + 1)
        } else {
          onComplete(2) // Both puzzles completed = perfect score
        }
      }, 1000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-300 via-yellow-200 to-green-200 p-4 flex flex-col items-center justify-center">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg mb-2">
          🧩 Arithmetic Grid Puzzle
        </h1>
        <p className="text-xl text-white drop-shadow-lg">
          {currentPuzzle.title} ({currentPuzzleIdx + 1}/{puzzles.length})
        </p>
      </motion.div>

      {/* Grid */}
      <motion.div
        key={currentPuzzleIdx}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-amber-700 to-amber-900 p-6 rounded-3xl shadow-2xl border-8 border-amber-950 mb-6"
      >
        <div className="bg-white p-6 rounded-lg inline-block">
          {gridState.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((cell, colIdx) => (
                <GridCell
                  key={`${rowIdx}-${colIdx}`}
                  cell={cell}
                  onChange={(value) =>
                    handleCellChange(rowIdx, colIdx, value)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Feedback and Buttons */}
      <AnimatePresence>
        {lastCorrectCheck === false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-2xl text-red-500 font-bold mb-4 drop-shadow-lg"
          >
            ✗ Please fill all boxes!
          </motion.div>
        )}
        {solved && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-3xl text-green-500 font-bold mb-4 drop-shadow-lg"
          >
            ✓ Correct! Moving to next puzzle...
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4">
        <button
          onClick={handleSubmit}
          disabled={solved}
          className="bg-gradient-to-b from-blue-400 to-blue-500 text-white text-2xl font-bold py-4 px-8 rounded-2xl
            border-4 border-blue-600 shadow-lg hover:shadow-xl hover:scale-105 transition-transform disabled:opacity-50"
        >
          Check Answer ✓
        </button>
      </div>
    </div>
  )
}

interface GridCellProps {
  cell: GridCell
  onChange: (value: string) => void
}

function GridCell({ cell, onChange }: GridCellProps) {
  if (cell.isBlock) {
    return <div className="w-12 h-12 bg-black rounded" />
  }

  if (!cell.editable) {
    return (
      <div className="w-12 h-12 bg-gray-100 border-2 border-gray-400 rounded flex items-center justify-center text-lg font-bold">
        {cell.value}
      </div>
    )
  }

  return (
    <input
      type="text"
      value={cell.value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={1}
      className="w-12 h-12 border-3 border-blue-400 rounded text-center text-lg font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
    />
  )
}
