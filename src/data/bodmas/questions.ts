import type { StandardQuestion } from '../../types/game'
import { createQuestionBank } from '../../game/questionEngine'

const questionBank = createQuestionBank()

export const questionsByLevel: Record<'easy' | 'medium' | 'hard', StandardQuestion[]> = {
  easy: questionBank.easy,
  medium: questionBank.medium,
  hard: questionBank.hard,
}
