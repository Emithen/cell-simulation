import './style.css'
import {
  DEFAULT_SIMULATION_CONFIG,
  addFood,
  createInitialState,
  getSimulationSummary,
  tick,
  type SimulationConfig,
  type SimulationState,
} from './simulation'

const CELL_SIZE = 24
const FOOD_BURST_COUNT = 24
const SPEED_OPTIONS = {
  slow: 900,
  normal: 450,
  fast: 140,
} as const

type SpeedKey = keyof typeof SPEED_OPTIONS

const config: SimulationConfig = DEFAULT_SIMULATION_CONFIG

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Evolution Observer v1</p>
        <h1>Cell Simulation</h1>
      </div>
      <div class="controls" aria-label="Simulation controls">
        <button id="toggle-button" type="button">Pause</button>
        <label class="field">
          <span>Speed</span>
          <select id="speed-select">
            <option value="slow">Slow</option>
            <option value="normal" selected>Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <button id="add-food-button" type="button">Add Food</button>
        <button id="reset-button" type="button">Reset</button>
      </div>
    </header>

    <section class="stats" aria-label="Simulation stats">
      <div>
        <span>Tick</span>
        <strong id="tick-count">0</strong>
      </div>
      <div>
        <span>Cells</span>
        <strong id="cell-count">0</strong>
      </div>
      <div>
        <span>Food</span>
        <strong id="food-count">0</strong>
      </div>
      <div>
        <span>Generation</span>
        <strong id="generation-count">0</strong>
      </div>
      <div>
        <span>Births</span>
        <strong id="birth-count">0</strong>
      </div>
      <div>
        <span>Deaths</span>
        <strong id="death-count">0</strong>
      </div>
    </section>

    <section class="lab-panel" aria-label="Population averages">
      <div>
        <span>Avg Energy</span>
        <strong id="energy-average">0.0</strong>
      </div>
      <div>
        <span>Avg Move Cost</span>
        <strong id="move-cost-average">0.00</strong>
      </div>
      <div>
        <span>Avg Divide</span>
        <strong id="divide-average">0</strong>
      </div>
      <div>
        <span>Avg Mutation</span>
        <strong id="mutation-average">0.0%</strong>
      </div>
      <div>
        <span>Avg Vision</span>
        <strong id="vision-average">0.0</strong>
      </div>
    </section>

    <canvas id="simulation-canvas" aria-label="Cell simulation grid"></canvas>
  </main>
`

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)

  if (!element) {
    throw new Error(`Missing required element: ${selector}`)
  }

  return element
}

const canvas = getRequiredElement<HTMLCanvasElement>('#simulation-canvas')
const tickCount = getRequiredElement<HTMLElement>('#tick-count')
const cellCount = getRequiredElement<HTMLElement>('#cell-count')
const foodCount = getRequiredElement<HTMLElement>('#food-count')
const generationCount = getRequiredElement<HTMLElement>('#generation-count')
const birthCount = getRequiredElement<HTMLElement>('#birth-count')
const deathCount = getRequiredElement<HTMLElement>('#death-count')
const energyAverage = getRequiredElement<HTMLElement>('#energy-average')
const moveCostAverage = getRequiredElement<HTMLElement>('#move-cost-average')
const divideAverage = getRequiredElement<HTMLElement>('#divide-average')
const mutationAverage = getRequiredElement<HTMLElement>('#mutation-average')
const visionAverage = getRequiredElement<HTMLElement>('#vision-average')
const resetButton = getRequiredElement<HTMLButtonElement>('#reset-button')
const toggleButton = getRequiredElement<HTMLButtonElement>('#toggle-button')
const addFoodButton = getRequiredElement<HTMLButtonElement>('#add-food-button')
const speedSelect = getRequiredElement<HTMLSelectElement>('#speed-select')

function getCanvasContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvasElement.getContext('2d')

  if (!canvasContext) {
    throw new Error('Canvas rendering is not supported')
  }

  return canvasContext
}

const context = getCanvasContext(canvas)

let state = createInitialState(config)
let isPaused = false
let speed: SpeedKey = 'normal'
let intervalId: number | undefined

function setupCanvas(simulationState: SimulationState): void {
  const pixelRatio = window.devicePixelRatio || 1
  const width = simulationState.width * CELL_SIZE
  const height = simulationState.height * CELL_SIZE

  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

function renderGrid(simulationState: SimulationState): void {
  const width = simulationState.width * CELL_SIZE
  const height = simulationState.height * CELL_SIZE

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#fbfcf7'
  context.fillRect(0, 0, width, height)

  context.strokeStyle = '#dde5d7'
  context.lineWidth = 1

  for (let x = 0; x <= simulationState.width; x += 1) {
    context.beginPath()
    context.moveTo(x * CELL_SIZE + 0.5, 0)
    context.lineTo(x * CELL_SIZE + 0.5, height)
    context.stroke()
  }

  for (let y = 0; y <= simulationState.height; y += 1) {
    context.beginPath()
    context.moveTo(0, y * CELL_SIZE + 0.5)
    context.lineTo(width, y * CELL_SIZE + 0.5)
    context.stroke()
  }
}

function renderFoods(simulationState: SimulationState): void {
  for (const food of simulationState.foods) {
    context.fillStyle = '#d99a2b'
    context.beginPath()
    context.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE * 0.2,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
}

function renderCells(simulationState: SimulationState): void {
  for (const cell of simulationState.cells) {
    const energyRatio = Math.max(0.25, Math.min(1, cell.energy / cell.dna.divideThreshold))
    const generationRatio = Math.min(1, cell.generation / 12)
    const cellX = cell.x * CELL_SIZE
    const cellY = cell.y * CELL_SIZE

    context.fillStyle = `rgba(41, 127, 88, ${energyRatio})`
    context.strokeStyle = `rgba(42, 78, 121, ${0.35 + generationRatio * 0.55})`
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(cellX + 4, cellY + 4, CELL_SIZE - 8, CELL_SIZE - 8, 5)
    context.fill()
    context.stroke()

    context.fillStyle = `rgba(42, 78, 121, ${0.3 + generationRatio * 0.7})`
    context.beginPath()
    context.arc(cellX + CELL_SIZE - 7, cellY + 7, 2.5 + generationRatio * 2, 0, Math.PI * 2)
    context.fill()
  }
}

function updateStats(simulationState: SimulationState): void {
  const summary = getSimulationSummary(simulationState)

  tickCount.textContent = simulationState.tick.toString()
  cellCount.textContent = simulationState.cells.length.toString()
  foodCount.textContent = simulationState.foods.length.toString()
  generationCount.textContent = summary.maxGeneration.toString()
  birthCount.textContent = simulationState.births.toString()
  deathCount.textContent = simulationState.deaths.toString()
  energyAverage.textContent = summary.averageEnergy.toFixed(1)
  moveCostAverage.textContent = summary.averageMoveCost.toFixed(2)
  divideAverage.textContent = Math.round(summary.averageDivideThreshold).toString()
  mutationAverage.textContent = `${(summary.averageMutationRate * 100).toFixed(1)}%`
  visionAverage.textContent = summary.averageVisionRange.toFixed(1)
}

function render(simulationState: SimulationState): void {
  renderGrid(simulationState)
  renderFoods(simulationState)
  renderCells(simulationState)
  updateStats(simulationState)
}

function resetSimulation(): void {
  state = createInitialState(config)
  setupCanvas(state)
  render(state)
}

function runStep(): void {
  if (isPaused) {
    return
  }

  state = tick(state, config)
  render(state)
}

function restartTimer(): void {
  if (intervalId !== undefined) {
    window.clearInterval(intervalId)
  }

  intervalId = window.setInterval(runStep, SPEED_OPTIONS[speed])
}

toggleButton.addEventListener('click', () => {
  isPaused = !isPaused
  toggleButton.textContent = isPaused ? 'Resume' : 'Pause'
})

speedSelect.addEventListener('change', () => {
  speed = speedSelect.value as SpeedKey
  restartTimer()
})

addFoodButton.addEventListener('click', () => {
  state = addFood(state, FOOD_BURST_COUNT, config)
  render(state)
})

resetButton.addEventListener('click', resetSimulation)

setupCanvas(state)
render(state)
restartTimer()
