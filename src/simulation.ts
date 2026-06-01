export type DNA = {
  moveCost: number
  divideThreshold: number
  mutationRate: number
  visionRange: number
}

export type Cell = {
  id: string
  x: number
  y: number
  energy: number
  age: number
  dna: DNA
}

export type Food = {
  id: string
  x: number
  y: number
  energy: number
}

export type SimulationState = {
  width: number
  height: number
  tick: number
  cells: Cell[]
  foods: Food[]
}

// 시뮬레이션 튜닝 파라미터
export type SimulationConfig = {
  width: number
  height: number
  initialCellCount: number
  initialFoodCount: number
  startEnergy: number
  foodEnergy: number
  survivalCost: number
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  width: 8,
  height: 8,
  initialCellCount: 2,
  initialFoodCount: 24,
  startEnergy: 40,
  foodEnergy: 20,
  survivalCost: 0.2,
}

// 초기 상태 생성 함수
function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createRandomDNA(): DNA {
  return {
    moveCost: 0.5 + Math.random() * 1.5,
    divideThreshold: randomInt(60, 120),
    mutationRate: 0.02 + Math.random() * 0.1,
    visionRange: randomInt(2, 7),
  }
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

export function createInitialState(
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): SimulationState {
  const state: SimulationState = {
    width: config.width,
    height: config.height,
    tick: 0,
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
      dna: createRandomDNA(),
    })
  }

  for (let i = 0; i < config.initialFoodCount; i += 1) {
    const position = getRandomEmptyPosition(state)
    if (position === null) break

    state.foods.push({
      id: createId('food'),
      x: position.x,
      y: position.y,
      energy: config.foodEnergy,
    })
  }

  return state
}

// 빈 grid 크기 정하기
// 랜덤 위치에 세포 10개 배치
// 랜덤 위치에 먹이 40개 배치
// 겹치는 좌표가 없게 하기

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

function getRandomMove(cell: Cell, state: SimulationState): { x: number; y: number } {
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]
  const direction = directions[randomInt(0, directions.length - 1)]
  const nextPosition = {
    x: cell.x + direction.x,
    y: cell.y + direction.y,
  }

  if (
    !isInsideGrid(state, nextPosition.x, nextPosition.y) ||
    hasCellAt(state, nextPosition.x, nextPosition.y)
  ) {
    return { x: cell.x, y: cell.y }
  }

  return nextPosition
}

// tick 함수 프로토타입
// export function tick(state: SimulationState): SimulationState
// 모든 세포 age + 1
// 모든 세포 energy - moveCost
// 에너지 0 이하 세포 제거
// tick + 1
export function tick(state: SimulationState): SimulationState {
  const nextCells: Cell[] = []
  const nextFoods: Food[] = [...state.foods]
  const nextState: SimulationState = {
    ...state,
    tick: state.tick + 1,
    cells: nextCells,
    foods: nextFoods,
  }

  for (const cell of state.cells) {
    const blockedCellState: SimulationState = {
      ...nextState,
      cells: [
        ...state.cells.filter((otherCell) => otherCell.id !== cell.id),
        ...nextCells,
      ],
    }
    const nextPosition = getRandomMove(cell, blockedCellState)
    const didMove = nextPosition.x !== cell.x || nextPosition.y !== cell.y
    const food = findFoodAt(nextState, nextPosition.x, nextPosition.y)
    const nextEnergy =
      cell.energy -
      DEFAULT_SIMULATION_CONFIG.survivalCost -
      (didMove ? cell.dna.moveCost : 0) +
      (food?.energy ?? 0)

    if (nextEnergy <= 0) {
      continue
    }

    if (food) {
      const foodIndex = nextFoods.findIndex((nextFood) => nextFood.id === food.id)

      if (foodIndex !== -1) {
        nextFoods.splice(foodIndex, 1)
      }
    }

    nextCells.push({
      ...cell,
      x: nextPosition.x,
      y: nextPosition.y,
      age: cell.age + 1,
      energy: nextEnergy,
    })
  }

  return {
    ...nextState,
    cells: nextCells,
    foods: nextFoods,
  }
}
