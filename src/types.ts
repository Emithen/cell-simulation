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
  generation: number
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
  births: number
  deaths: number
  cells: Cell[]
  foods: Food[]
}

export type SimulationConfig = {
  // grid 사이즈
  width: number
  height: number

  // 초기 설정
  initialCellCount: number
  initialFoodCount: number

  // Cell 속성
  startEnergy: number
  foodEnergy: number
  survivalCost: number
  energySplitRatio: number
  mutationStep: number
  maxAge: number

  // Food 속성
  foodSpawnRate: number
  maxFoodCount: number
}

export type SimulationSummary = {
  averageEnergy: number
  averageMoveCost: number
  averageDivideThreshold: number
  averageMutationRate: number
  averageVisionRange: number
  maxGeneration: number
}
