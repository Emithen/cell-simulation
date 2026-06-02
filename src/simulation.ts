import type { DNA, Cell, Food, SimulationConfig, SimulationState, SimulationSummary } from './types'

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  width: 28,
  height: 18,
  initialCellCount: 8,
  initialFoodCount: 86,
  startEnergy: 40,
  foodEnergy: 20,
  survivalCost: 0.2,
  foodSpawnRate: 4,
  maxFoodCount: 140,
  energySplitRatio: 0.48,
  mutationStep: 0.16,
  maxAge: 520,
}

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createRandomDNA(): DNA {
  return {
    moveCost: 0.5 + Math.random() * 1.5,
    divideThreshold: randomInt(60, 120),
    mutationRate: 0.02 + Math.random() * 0.1,
    visionRange: randomInt(2, 7),
  }
}

function hasCellAt(state: SimulationState, x: number, y: number): boolean {
  return state.cells.some((cell) => cell.x === x && cell.y === y)
}

function hasFoodAt(state: SimulationState, x: number, y: number): boolean {
  return state.foods.some((food) => food.x === x && food.y === y)
}

function isOccupied(state: SimulationState, x: number, y: number): boolean {
  return hasCellAt(state, x, y) || hasFoodAt(state, x, y)
}

function findFoodAt(state: SimulationState, x: number, y: number): Food | undefined {
  return state.foods.find((food) => food.x === x && food.y === y)
}

function isInsideGrid(state: SimulationState, x: number, y: number): boolean {
  return x >= 0 && x < state.width && y >= 0 && y < state.height
}

function getRandomEmptyPosition(state: SimulationState): { x: number; y: number } | null {
  const maxAttempts = state.width * state.height

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = randomInt(0, state.width - 1)
    const y = randomInt(0, state.height - 1)

    if (!isOccupied(state, x, y)) {
      return { x, y }
    }
  }

  return null
}

function getManhattanDistance(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
}

function getOpenNeighborPositions(
  cell: Cell,
  state: SimulationState,
): Array<{ x: number; y: number }> {
  return DIRECTIONS.map((direction) => ({
    x: cell.x + direction.x,
    y: cell.y + direction.y,
  })).filter(
    (position) =>
      isInsideGrid(state, position.x, position.y) &&
      !hasCellAt(state, position.x, position.y),
  )
}

function getNextPosition(cell: Cell, state: SimulationState): { x: number; y: number } {
  const openPositions = getOpenNeighborPositions(cell, state)

  if (openPositions.length === 0) {
    return { x: cell.x, y: cell.y }
  }

  const nearbyFoods = state.foods
    .map((food) => ({
      food,
      distance: getManhattanDistance(cell, food),
    }))
    .filter(({ distance }) => distance <= cell.dna.visionRange)
    .sort((first, second) => first.distance - second.distance)

  if (nearbyFoods.length === 0) {
    return openPositions[randomInt(0, openPositions.length - 1)]
  }

  const target = nearbyFoods[0].food
  const bestPositions = openPositions
    .map((position) => ({
      position,
      distance: getManhattanDistance(position, target),
    }))
    .sort((first, second) => first.distance - second.distance)
  const bestDistance = bestPositions[0].distance
  const candidates = bestPositions.filter(({ distance }) => distance === bestDistance)

  return candidates[randomInt(0, candidates.length - 1)].position
}

function createFoodAt(x: number, y: number, config: SimulationConfig): Food {
  return {
    id: createId('food'),
    x,
    y,
    energy: config.foodEnergy,
  }
}

function shouldMutate(mutationRate: number): boolean {
  return Math.random() < mutationRate
}

function mutateDNA(dna: DNA, config: SimulationConfig): DNA {
  const mutationAmount = (): number => (Math.random() * 2 - 1) * config.mutationStep

  return {
    moveCost: clamp(dna.moveCost + mutationAmount(), 0.25, 3),
    divideThreshold: Math.round(
      clamp(dna.divideThreshold + mutationAmount() * 40, 35, 160),
    ),
    mutationRate: clamp(dna.mutationRate + mutationAmount() * 0.04, 0.005, 0.18),
    visionRange: Math.round(clamp(dna.visionRange + mutationAmount() * 4, 1, 10)),
  }
}

function createChildCell(
  parent: Cell,
  position: { x: number; y: number },
  energy: number,
  config: SimulationConfig,
): Cell {
  return {
    ...parent,
    id: createId('cell'),
    x: position.x,
    y: position.y,
    energy,
    age: 0,
    generation: parent.generation + 1,
    dna: shouldMutate(parent.dna.mutationRate) ? mutateDNA(parent.dna, config) : { ...parent.dna },
  }
}

export function createInitialState(
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): SimulationState {
  const state: SimulationState = {
    width: config.width,
    height: config.height,
    tick: 0,
    births: 0,
    deaths: 0,
    cells: [],
    foods: [],
  }

  for (let i = 0; i < config.initialCellCount; i += 1) {
    const position = getRandomEmptyPosition(state)

    if (position === null) {
      break
    }

    state.cells.push({
      id: createId('cell'),
      x: position.x,
      y: position.y,
      energy: config.startEnergy,
      age: 0,
      generation: 1,
      dna: createRandomDNA(),
    })
  }

  return addFood(state, config.initialFoodCount, config)
}

export function addFood(
  state: SimulationState,
  count = 12,
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): SimulationState {
  const nextFoods = [...state.foods]
  const nextState: SimulationState = {
    ...state,
    foods: nextFoods,
  }

  for (let i = 0; i < count && nextFoods.length < config.maxFoodCount; i += 1) {
    const position = getRandomEmptyPosition(nextState)

    if (position === null) {
      break
    }

    nextFoods.push(createFoodAt(position.x, position.y, config))
  }

  return {
    ...state,
    foods: nextFoods,
  }
}

function spawnFood(state: SimulationState, config: SimulationConfig): Food[] {
  return addFood(state, config.foodSpawnRate, config).foods
}

/*
함수명: getSimulationSummary

설명: 시뮬레이션의 요약 정보를 계산한다.

사용: 
  main.ts
    updateStats()
      getSimulationSummary(state)
  > 현황 보드에 표시할 정보를 갱신

인자:
  state: SimulationState

반환값:
  SimulationSummary
*/
export function getSimulationSummary(state: SimulationState): SimulationSummary {
  if (state.cells.length === 0) {
    return {
      averageEnergy: 0,
      averageMoveCost: 0,
      averageDivideThreshold: 0,
      averageMutationRate: 0,
      averageVisionRange: 0,
      maxGeneration: 0,
    }
  }

  const totals = state.cells.reduce(
    (summary, cell) => ({
      energy: summary.energy + cell.energy,
      moveCost: summary.moveCost + cell.dna.moveCost,
      divideThreshold: summary.divideThreshold + cell.dna.divideThreshold,
      mutationRate: summary.mutationRate + cell.dna.mutationRate,
      visionRange: summary.visionRange + cell.dna.visionRange,
      maxGeneration: Math.max(summary.maxGeneration, cell.generation),
    }),
    {
      energy: 0,
      moveCost: 0,
      divideThreshold: 0,
      mutationRate: 0,
      visionRange: 0,
      maxGeneration: 0,
    },
  )

  return {
    averageEnergy: totals.energy / state.cells.length,
    averageMoveCost: totals.moveCost / state.cells.length,
    averageDivideThreshold: totals.divideThreshold / state.cells.length,
    averageMutationRate: totals.mutationRate / state.cells.length,
    averageVisionRange: totals.visionRange / state.cells.length,
    maxGeneration: totals.maxGeneration,
  }
}

/*
함수명: tick

설명: 시뮬레이션의 한 틱을 처리한다.

인자:
  state: SimulationState
  config: SimulationConfig

반환값:
  SimulationState
*/
export function tick(
  state: SimulationState,
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): SimulationState {
  // 변수 선언
  const nextCells: Cell[] = []
  let nextFoods: Food[] = [...state.foods]
  let births = state.births
  let deaths = state.deaths

  // 기본값 설정
  const nextStateBase: SimulationState = {
    ...state,
    tick: state.tick + 1,
    cells: nextCells,
    foods: nextFoods,
  }

  // 모든 세포 갱신
  for (let cellIndex = 0; cellIndex < state.cells.length; cellIndex += 1) {
    const cell = state.cells[cellIndex]
    const blockedCellState: SimulationState = {
      ...nextStateBase,
      cells: [...state.cells.slice(cellIndex + 1), ...nextCells],
      foods: nextFoods,
    }
    const nextPosition = getNextPosition(cell, blockedCellState)
    const didMove = nextPosition.x !== cell.x || nextPosition.y !== cell.y
    const food = findFoodAt({ ...nextStateBase, foods: nextFoods }, nextPosition.x, nextPosition.y)
    const nextEnergy =
      cell.energy -
      config.survivalCost -
      (didMove ? cell.dna.moveCost : 0) +
      (food?.energy ?? 0)

    if (nextEnergy <= 0 || cell.age + 1 > config.maxAge) {
      deaths += 1
      continue
    }

    if (food) {
      nextFoods = nextFoods.filter((nextFood) => nextFood.id !== food.id)
    }

    // 업데이트된 세포 생성
    const updatedCell: Cell = {
      ...cell,
      x: nextPosition.x,
      y: nextPosition.y,
      age: cell.age + 1,
      energy: nextEnergy,
    }

    const divisionState: SimulationState = {
      ...nextStateBase,
      cells: [...nextCells, updatedCell],
      foods: nextFoods,
    }
    const childPositions = getOpenNeighborPositions(updatedCell, divisionState)

    // nextCells 에 Cell 추가
    if (nextEnergy >= updatedCell.dna.divideThreshold && childPositions.length > 0) {
      const childEnergy = nextEnergy * config.energySplitRatio
      const parentEnergy = nextEnergy - childEnergy
      const childPosition = childPositions[randomInt(0, childPositions.length - 1)]

      nextCells.push({
        ...updatedCell,
        energy: parentEnergy,
      })
      nextCells.push(createChildCell(updatedCell, childPosition, childEnergy, config))
      births += 1
    } else {
      nextCells.push(updatedCell)
    }
  }

  // births, deaths, cells, foods 갱신
  const nextState: SimulationState = {
    ...nextStateBase,
    births,
    deaths,
    cells: nextCells,
    foods: nextFoods,
  }

  // 음식 추가
  return {
    ...nextState,
    foods: spawnFood(nextState, config),
  }
}
