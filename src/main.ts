import './style.css'
import { createInitialState, tick, type SimulationState } from './simulation'

const CELL_SIZE = 16
const TICK_MS = 1000

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Life Simulation MVP</p>
        <h1>Cell Simulation</h1>
      </div>
      <button id="reset-button" type="button">Reset</button>
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
const resetButton = getRequiredElement<HTMLButtonElement>('#reset-button')

function getCanvasContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvasElement.getContext('2d')

  if (!canvasContext) {
    throw new Error('Canvas rendering is not supported')
  }

  return canvasContext
}

const context = getCanvasContext(canvas)

let state = createInitialState()

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

function render(simulationState: SimulationState): void {
  const width = simulationState.width * CELL_SIZE
  const height = simulationState.height * CELL_SIZE

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#f8faf5'
  context.fillRect(0, 0, width, height)

  context.strokeStyle = '#dfe5d8'
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

  for (const food of simulationState.foods) {
    context.fillStyle = '#d89b24'
    context.beginPath()
    context.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE * 0.24,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  for (const cell of simulationState.cells) {
    const energyRatio = Math.max(0.25, Math.min(1, cell.energy / 40))

    context.fillStyle = `rgba(47, 133, 90, ${energyRatio})`
    context.fillRect(
      cell.x * CELL_SIZE + 3,
      cell.y * CELL_SIZE + 3,
      CELL_SIZE - 6,
      CELL_SIZE - 6,
    )
  }

  tickCount.textContent = simulationState.tick.toString()
  cellCount.textContent = simulationState.cells.length.toString()
  foodCount.textContent = simulationState.foods.length.toString()
}

function resetSimulation(): void {
  state = createInitialState()
  setupCanvas(state)
  render(state)
}

resetButton.addEventListener('click', resetSimulation)

setupCanvas(state)
render(state)

window.setInterval(() => {
  state = tick(state)
  render(state)
}, TICK_MS)
