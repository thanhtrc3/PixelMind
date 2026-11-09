import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AiCostStats } from '../../shared/ai'

const safeId = (val?: string): string => (val || '_global').replace(/[^a-zA-Z0-9._-]/g, '_')

const budgetFilePath = (projectId?: string): string => {
  const dir = join(app.getPath('userData'), 'pixelmind-ai', safeId(projectId))
  return join(dir, 'budget.json')
}

interface StoredBudget {
  promptTokens: number
  completionTokens: number
  budgetTokens: number
  lastUpdated: number
}

const DEFAULT_BUDGET = 100_000 // 100k tokens per project

// Giá ước lượng gpt-4o-mini (Input: $0.15 / 1M, Output: $0.60 / 1M)
const PRICE_PROMPT_PER_TOKEN = 0.15 / 1_000_000
const PRICE_COMPLETION_PER_TOKEN = 0.60 / 1_000_000

async function readStoredBudget(projectId?: string): Promise<StoredBudget> {
  try {
    const raw = await fs.readFile(budgetFilePath(projectId), 'utf8')
    return JSON.parse(raw) as StoredBudget
  } catch {
    return {
      promptTokens: 0,
      completionTokens: 0,
      budgetTokens: DEFAULT_BUDGET,
      lastUpdated: Date.now(),
    }
  }
}

async function writeStoredBudget(projectId: string | undefined, data: StoredBudget): Promise<void> {
  try {
    const file = budgetFilePath(projectId)
    await fs.mkdir(join(file, '..'), { recursive: true })
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Cost] Không thể ghi tệp ngân sách:', err)
  }
}

export function computeStats(projectId: string | undefined, data: StoredBudget): AiCostStats {
  const totalTokens = data.promptTokens + data.completionTokens
  const estimatedCostUsd =
    data.promptTokens * PRICE_PROMPT_PER_TOKEN +
    data.completionTokens * PRICE_COMPLETION_PER_TOKEN
  const budget = data.budgetTokens || DEFAULT_BUDGET
  const percentageUsed = Math.min(100, Math.round((totalTokens / budget) * 100))

  return {
    projectId,
    promptTokens: data.promptTokens,
    completionTokens: data.completionTokens,
    totalTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    budgetTokens: budget,
    percentageUsed,
    isOverBudget: totalTokens >= budget,
    isNearBudget: totalTokens >= budget * 0.8,
  }
}

export async function getCostStats(projectId?: string): Promise<AiCostStats> {
  const stored = await readStoredBudget(projectId)
  return computeStats(projectId, stored)
}

export async function recordTokenUsage(
  projectId: string | undefined,
  promptTokens: number,
  completionTokens: number,
): Promise<AiCostStats> {
  const stored = await readStoredBudget(projectId)
  stored.promptTokens += promptTokens
  stored.completionTokens += completionTokens
  stored.lastUpdated = Date.now()
  await writeStoredBudget(projectId, stored)
  return computeStats(projectId, stored)
}

export async function setTokenBudget(
  projectId: string,
  budgetTokens: number,
): Promise<AiCostStats> {
  const stored = await readStoredBudget(projectId)
  stored.budgetTokens = Math.max(10_000, Math.min(10_000_000, budgetTokens))
  stored.lastUpdated = Date.now()
  await writeStoredBudget(projectId, stored)
  return computeStats(projectId, stored)
}

export async function resetCostStats(projectId?: string): Promise<boolean> {
  try {
    const file = budgetFilePath(projectId)
    await fs.unlink(file)
    return true
  } catch {
    return false
  }
}

