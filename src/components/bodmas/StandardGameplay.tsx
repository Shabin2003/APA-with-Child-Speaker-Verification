import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { GameUI } from './GameUI'
import { useSmartSpeech } from '../../hooks/useSmartSpeech'
import { playCoin, playFanfare, playWrong, playLevelComplete } from '../../lib/sounds'
import type { StandardQuestion, StandardDifficulty } from '../../types/game'

interface StandardGameplayProps {
  questions: StandardQuestion[]
  difficulty: StandardDifficulty
  onComplete: (score: number) => void
}

const normalizeNumber = (value: number): number => Math.round(value * 100) / 100

const parseWordNumber = (tokens: string[]): number | null => {
  const units: Record<string, number> = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
    ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
    sixteen:16,seventeen:17,eighteen:18,nineteen:19,
  }
  const tens: Record<string, number> = {
    twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
  }
  let current = 0
  let parsed = false
  for (const token of tokens) {
    if (token === 'and') continue
    if (token in units)   { current += units[token]; parsed = true; continue }
    if (token in tens)    { current += tens[token];  parsed = true; continue }
    if (token === 'hundred') { current = current === 0 ? 100 : current * 100; parsed = true; continue }
    return null
  }
  return parsed ? current : null
}

const parseSpokenAnswer = (rawText: string): number | null => {
  const text = rawText.toLowerCase().trim()
  if (!text) return null

  const numericMatch = text.match(/-?\d+(?:\.\d+)?/)
  if (numericMatch) return normalizeNumber(Number(numericMatch[0]))

  let sign = 1
  let cleaned = text
  if (cleaned.includes('minus') || cleaned.includes('negative')) {
    sign = -1
    cleaned = cleaned.replace(/minus|negative/g, '')
  }

  const tokens = cleaned.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (!tokens.length) return null

  const pointIdx = tokens.indexOf('point')
  if (pointIdx >= 0) {
    const intPart = pointIdx === 0 ? 0 : parseWordNumber(tokens.slice(0, pointIdx))
    const fracTokens = tokens.slice(pointIdx + 1)
    if (intPart === null || !fracTokens.length) return null
    const digitMap: Record<string,string> = {zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'}
    const dec = fracTokens.map(t => digitMap[t]).join('')
    if (dec.length !== fracTokens.length) return null
    return normalizeNumber(sign * Number(`${intPart}.${dec}`))
  }

  const whole = parseWordNumber(tokens)
  return whole === null ? null : normalizeNumber(sign * whole)
}

export function StandardGameplay({ questions, difficulty, onComplete }: StandardGameplayProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore]               = useState(0)
  const [answered, setAnswered]         = useState(false)
  const [submittedAnswer, setSubmittedAnswer] = useState<number | null>(null)
  const [answerIsCorrect, setAnswerIsCorrect] = useState(false)
  const [showTransition, setShowTransition]   = useState(false)
  const [manualAnswer, setManualAnswer] = useState('')
  const [statusMsg, setStatusMsg]       = useState('Tap the mic and say your answer, or type it below.')

  const scoreRef = useRef(0)
  const currentQuestion = questions[currentIndex]

  // FastAPI ASR recorder — 5 seconds auto-stop for numbers
  const asr = useSmartSpeech(5000)

  // When ASR transcript arrives, parse it as a number
  useEffect(() => {
    if (!asr.transcript || asr.isRecording || asr.isTranscribing || answered) return
    const parsed = parseSpokenAnswer(asr.transcript)
    if (parsed === null) {
      setStatusMsg(`I heard "${asr.transcript}" but couldn't parse a number. Type it below or try again.`)
    } else {
      setManualAnswer(String(parsed))
      setStatusMsg(`Heard: ${parsed}. Tap Submit Answer to check.`)
    }
  }, [asr.transcript, asr.isRecording, asr.isTranscribing, answered])

  const handleAnswer = (answer: number) => {
    if (answered) return
    const norm = normalizeNumber(answer)
    const correct = Math.abs(norm - currentQuestion.correctAnswer) < 0.01
    setSubmittedAnswer(norm)
    setAnswerIsCorrect(correct)
    setAnswered(true)
    if (correct) {
      scoreRef.current += 1
      setScore(scoreRef.current)
    }
    if (correct) playCoin()
    else         playWrong()
  }

  const handleSubmit = () => {
    if (answered) return
    const parsed = parseSpokenAnswer(manualAnswer)
    if (parsed === null) {
      setStatusMsg('Please speak or type a valid number first.')
      return
    }
    handleAnswer(parsed)
  }

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setShowTransition(true)
      setTimeout(() => {
        setCurrentIndex(i => i + 1)
        setAnswered(false)
        setSubmittedAnswer(null)
        setAnswerIsCorrect(false)
        setManualAnswer('')
        setStatusMsg('Tap the mic and say your answer, or type it below.')
        asr.reset()
        setShowTransition(false)
      }, 500)
    } else {
      // Play level complete fanfare based on final score
      const finalScore = scoreRef.current
      const pct = (finalScore / questions.length) * 100
      if (pct === 100) playFanfare()
      else if (pct >= 60) playLevelComplete()
      else playCoin()
      onComplete(finalScore)
    }
  }

  if (showTransition) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-300 via-yellow-200 to-green-200 flex items-center justify-center">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }} className="text-6xl">✨</motion.div>
      </div>
    )
  }

  return (
    <GameUI
      question={currentQuestion.expression}
      score={score}
      currentQuestion={currentIndex + 1}
      totalQuestions={questions.length}
    >
      <div className="space-y-5">
        <div className="text-center text-yellow-100 font-bold text-xl">
          {difficulty.toUpperCase()} Level — Say or type your answer
        </div>

        {/* ASR controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <button
            onClick={asr.isRecording ? asr.stop : asr.start}
            disabled={answered || asr.isTranscribing}
            className={`text-white text-xl font-bold py-4 px-8 rounded-2xl border-4 border-yellow-300 shadow-lg transition-transform disabled:opacity-60 ${
              asr.isRecording
                ? 'bg-gradient-to-b from-red-400 to-red-500 animate-pulse'
                : 'bg-gradient-to-b from-pink-400 to-pink-500 hover:scale-105'
            }`}
          >
            {asr.isRecording ? '🔴 Listening...' : '🎤 Speak Answer'}
          </button>

          <button
            onClick={handleSubmit}
            disabled={answered || asr.isRecording || asr.isTranscribing}
            className="bg-gradient-to-b from-blue-400 to-blue-500 text-white text-xl font-bold py-4 px-8 rounded-2xl border-4 border-yellow-300 shadow-lg hover:scale-105 transition-transform disabled:opacity-60"
          >
            Submit Answer
          </button>
        </div>

        {/* Status */}
        <div className="bg-white/85 rounded-xl p-4 border-2 border-yellow-200">
          {asr.isTranscribing ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing with Wav2Vec2 ASR...</span>
            </div>
          ) : (
            <p className="text-slate-700 text-lg font-semibold">{statusMsg}</p>
          )}
          {asr.transcript && !asr.isRecording && (
            <p className="text-slate-800 mt-2 text-sm">Heard: <span className="font-bold">"{asr.transcript}"</span></p>
          )}
          {asr.error && (
            <p className="text-red-600 text-sm mt-1">{asr.error}</p>
          )}
        </div>

        {/* Manual input */}
        <div className="flex items-center justify-center gap-3">
          <label className="text-yellow-100 font-bold text-lg">Type Answer:</label>
          <input
            value={manualAnswer}
            onChange={e => setManualAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={answered}
            inputMode="decimal"
            className="w-40 rounded-lg border-4 border-yellow-300 px-3 py-2 text-xl font-bold text-slate-800 text-center"
            placeholder="e.g. 12"
          />
        </div>
      </div>

      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="mt-6 text-center"
          >
            {answerIsCorrect ? (
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.5 }}
                className="text-4xl text-green-400 font-bold mb-4 drop-shadow-lg">✓ Correct!</motion.div>
            ) : (
              <motion.div animate={{ x: [-5, 5, -5, 0] }} transition={{ duration: 0.5 }}
                className="text-4xl text-red-400 font-bold mb-4 drop-shadow-lg">✗ Not quite!</motion.div>
            )}
            <p className="text-lg text-yellow-100 font-semibold mb-2">Your answer: {submittedAnswer ?? 'N/A'}</p>
            {!answerIsCorrect && (
              <p className="text-lg text-yellow-100 font-semibold mb-4">Correct: {currentQuestion.correctAnswer}</p>
            )}
            <button
              onClick={handleNext}
              className="bg-gradient-to-b from-yellow-300 to-yellow-400 text-white text-2xl font-bold py-4 px-12 rounded-2xl border-4 border-yellow-500 shadow-lg hover:scale-105 transition-transform"
            >
              {currentIndex + 1 === questions.length ? '🏁 Finish' : 'Next →'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </GameUI>
  )
}
