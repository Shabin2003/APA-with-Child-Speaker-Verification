import type { GridPuzzle } from '../types/game'

export const extremePuzzles: GridPuzzle[] = [
  {
    id: 'extreme-1',
    title: 'Jungle Puzzle 1',
    grid: [
      [
        { value: '', editable: true },
        { value: '+', editable: false },
        { value: '', editable: true },
        { value: '=', editable: false },
        { value: '5', editable: false },
      ],
      [
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
      ],
      [
        { value: '3', editable: false },
        { value: '×', editable: false },
        { value: '', editable: true },
        { value: '=', editable: false },
        { value: '', editable: true },
      ],
      [
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
      ],
      [
        { value: '=', editable: false },
        { value: '', editable: false },
        { value: '=', editable: false },
        { value: '', editable: false },
        { value: '=', editable: false },
      ],
    ],
  },
  {
    id: 'extreme-2',
    title: 'Jungle Puzzle 2',
    grid: [
      [
        { value: '', editable: true },
        { value: '+', editable: false },
        { value: '2', editable: false },
        { value: '=', editable: false },
        { value: '', editable: true },
      ],
      [
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
      ],
      [
        { value: '4', editable: false },
        { value: '÷', editable: false },
        { value: '', editable: true },
        { value: '=', editable: false },
        { value: '2', editable: false },
      ],
      [
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
        { value: '', editable: false },
      ],
      [
        { value: '=', editable: false },
        { value: '', editable: false },
        { value: '=', editable: false },
        { value: '', editable: false },
        { value: '=', editable: false },
      ],
    ],
  },
]
