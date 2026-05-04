export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'

export type StandardDifficulty = Exclude<Difficulty, 'extreme'>

export type Operator = '+' | '-' | '×' | '÷'

export type GamePhase = 'start' | 'playing' | 'result'

export interface StandardQuestion {
  id: string
  difficulty: StandardDifficulty
  expression: string
  correctAnswer: number
  choices: number[]
}

export interface QuestionBank {
  easy: StandardQuestion[]
  medium: StandardQuestion[]
  hard: StandardQuestion[]
}

export type GridCell = {
  value: string
  editable?: boolean
  isBlock?: boolean
}

export type GridPuzzle = {
  id: string
  title: string
  grid: GridCell[][]
}
