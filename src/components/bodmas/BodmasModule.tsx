import { useState } from 'react'
import { LevelSelector } from './LevelSelector'
import { StandardGameplay } from './StandardGameplay'
import { ResultsScreen } from './ResultsScreen'
import { questionsByLevel } from '../../data/bodmas/questions'
import type { StandardDifficulty } from '../../types/game'

type Phase = 'menu' | 'playing' | 'results'

export function BodmasModule() {
  const [phase, setPhase]     = useState<Phase>('menu')
  const [level, setLevel]     = useState<StandardDifficulty | null>(null)
  const [score, setScore]     = useState(0)

  if (phase === 'menu') return <LevelSelector onSelectLevel={l => { setLevel(l); setPhase('playing') }} />
  if (phase === 'playing' && level) {
    return (
      <StandardGameplay
        questions={questionsByLevel[level]}
        difficulty={level}
        onComplete={s => { setScore(s); setPhase('results') }}
      />
    )
  }
  if (phase === 'results' && level) {
    return (
      <ResultsScreen
        score={score}
        totalQuestions={10}
        difficulty={level}
        onBackToMenu={() => { setPhase('menu'); setLevel(null); setScore(0) }}
      />
    )
  }
  return null
}
