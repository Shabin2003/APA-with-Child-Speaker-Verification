import type { Operator, QuestionBank, StandardDifficulty, StandardQuestion } from '../types/game'

const EASY_COUNT = 10
const MEDIUM_COUNT = 10
const HARD_COUNT = 10

const EASY_RANGE = { min: 1, max: 20 }
const MEDIUM_RANGE = { min: 1, max: 18 }
const HARD_RANGE = { min: 1, max: 15 }

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const normalizeResult = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? rounded : rounded
}

const applyOperator = (a: number, b: number, op: Operator): number => {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return a / b
  }
}

const evaluateBodmasExpression = (expression: string): number => {
  const jsExpression = expression.replace(/×/g, '*').replace(/÷/g, '/')
  const result = Function(`return (${jsExpression})`)() as number
  return normalizeResult(result)
}

const generateChoices = (answer: number): number[] => {
  const distractors = new Set<number>()

  while (distractors.size < 3) {
    const delta = randomInt(1, 6)
    const sign = Math.random() > 0.5 ? 1 : -1
    const candidate = normalizeResult(answer + sign * delta)
    if (candidate !== answer) distractors.add(candidate)
  }

  return shuffle([answer, ...distractors])
}

const uniqueId = (difficulty: StandardDifficulty, index: number): string =>
  `${difficulty}-${index + 1}`

const buildEasyQuestion = (index: number): StandardQuestion => {
  const ops: Operator[] = ['+', '-', '×', '÷']
  const op = ops[index % ops.length]

  let a = randomInt(EASY_RANGE.min, EASY_RANGE.max)
  let b = randomInt(EASY_RANGE.min, EASY_RANGE.max)

  if (op === '÷') {
    b = randomInt(1, 10)
    const quotient = randomInt(1, 10)
    a = b * quotient
  }

  if (op === '-') {
    if (a < b) [a, b] = [b, a]
  }

  const expression = `${a} ${op} ${b}`
  const correctAnswer = normalizeResult(applyOperator(a, b, op))

  return {
    id: uniqueId('easy', index),
    difficulty: 'easy',
    expression,
    correctAnswer,
    choices: generateChoices(correctAnswer),
  }
}

const buildMediumQuestion = (index: number): StandardQuestion => {
  const operatorPool: Operator[] = ['+', '-', '×']
  const bracketLeft = randomInt(MEDIUM_RANGE.min, MEDIUM_RANGE.max)
  const bracketRight = randomInt(MEDIUM_RANGE.min, MEDIUM_RANGE.max)
  const outside = randomInt(MEDIUM_RANGE.min, MEDIUM_RANGE.max)

  const innerOp = operatorPool[randomInt(0, operatorPool.length - 1)]
  const outerOp = operatorPool[randomInt(0, operatorPool.length - 1)]

  const expression = `(${bracketLeft} ${innerOp} ${bracketRight}) ${outerOp} ${outside}`
  const correctAnswer = evaluateBodmasExpression(expression)

  return {
    id: uniqueId('medium', index),
    difficulty: 'medium',
    expression,
    correctAnswer,
    choices: generateChoices(correctAnswer),
  }
}

const buildHardQuestion = (index: number): StandardQuestion => {
  const a = randomInt(HARD_RANGE.min, HARD_RANGE.max)
  const b = randomInt(HARD_RANGE.min, HARD_RANGE.max)
  const c = randomInt(HARD_RANGE.min, HARD_RANGE.max)
  const d = randomInt(HARD_RANGE.min, HARD_RANGE.max)
  const e = randomInt(HARD_RANGE.min, HARD_RANGE.max)
  const f = randomInt(HARD_RANGE.min, HARD_RANGE.max)

  const operators1: Operator[] = ['+', '-', '×']
  const operators2: Operator[] = ['+', '-', '×']
  const operators3: Operator[] = ['+', '×']

  const op1 = operators1[randomInt(0, operators1.length - 1)]
  const op2 = operators2[randomInt(0, operators2.length - 1)]
  const op3 = operators3[randomInt(0, operators3.length - 1)]

  const expression = `(${a} ${op1} ${b}) ÷ ${Math.max(1, c)} ${op3} (${d} ${op2} ${e}) - ${f}`
  const correctAnswer = evaluateBodmasExpression(expression)

  return {
    id: uniqueId('hard', index),
    difficulty: 'hard',
    expression,
    correctAnswer,
    choices: generateChoices(correctAnswer),
  }
}

export const createQuestionBank = (): QuestionBank => {
  const easy = Array.from({ length: EASY_COUNT }, (_, i) => buildEasyQuestion(i))
  const medium = Array.from({ length: MEDIUM_COUNT }, (_, i) => buildMediumQuestion(i))
  const hard = Array.from({ length: HARD_COUNT }, (_, i) => buildHardQuestion(i))

  return { easy, medium, hard }
}
