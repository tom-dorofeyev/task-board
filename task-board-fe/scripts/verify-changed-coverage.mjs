import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const requiredPercentage = 90
const changedLinesByFile = readChangedLines()
const coverageByFile = readCoverage()
const changedSourceFiles = [...changedLinesByFile.keys()].filter((file) =>
  coverageByFile.has(file),
)

if (changedSourceFiles.length === 0) {
  console.log('No changed source lines require differential coverage.')
} else {
  verifyChangedCoverage()
}

function verifyChangedCoverage() {
  const measuredSourceFiles = changedSourceFiles.filter((file) =>
    coverageByFile.has(file),
  )
  const changedExecutableLines = measuredSourceFiles.flatMap((file) =>
    findChangedExecutableLines(file),
  )
  const coveredLines = changedExecutableLines.filter(({ hits }) => hits > 0)
  const percentage = (coveredLines.length / changedExecutableLines.length) * 100

  if (measuredSourceFiles.length !== changedSourceFiles.length)
    throw new Error('Changed source coverage is missing a routing module.')
  if (changedExecutableLines.length === 0)
    throw new Error('Changed source coverage did not contain executable lines.')
  if (percentage < requiredPercentage)
    throw new Error(
      `Changed executable line coverage ${percentage.toFixed(2)}% is below ${requiredPercentage}%.`,
    )

  console.log(
    `Changed executable routing lines: ${percentage.toFixed(2)}% (${coveredLines.length}/${changedExecutableLines.length}); modules: ${measuredSourceFiles.length}/${changedSourceFiles.length}.`,
  )
}

function readChangedLines() {
  const comparisonBase = resolveComparisonBase()
  const diff = execFileSync(
    'git',
    ['diff', '--unified=0', comparisonBase, '--', 'src'],
    { encoding: 'utf8' },
  )
  const changedLines = new Map()
  let currentFile = ''

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) currentFile = line.slice(6)
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (!hunk || !currentFile) continue
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    const fileLines = changedLines.get(currentFile) ?? new Set()
    for (let offset = 0; offset < count; offset += 1)
      fileLines.add(start + offset)
    changedLines.set(currentFile, fileLines)
  }

  return changedLines
}

function resolveComparisonBase() {
  const baseRevision = process.env.COVERAGE_BASE_REF
  if (!baseRevision) return 'HEAD'
  return execFileSync('git', ['merge-base', baseRevision, 'HEAD'], {
    encoding: 'utf8',
  }).trim()
}

function readCoverage() {
  const records = readFileSync('coverage/lcov.info', 'utf8').split(
    'end_of_record',
  )
  const coverage = new Map()

  for (const record of records) {
    const file = record.match(/^SF:(.+)$/m)?.[1]
    if (!file) continue
    const lines = [...record.matchAll(/^DA:(\d+),(\d+)$/gm)].map((match) => ({
      line: Number(match[1]),
      hits: Number(match[2]),
    }))
    coverage.set(file, lines)
  }

  return coverage
}

function findChangedExecutableLines(file) {
  const changedLines = changedLinesByFile.get(file)
  const measuredLines = coverageByFile.get(file) ?? []
  const exactLines = measuredLines.filter(({ line }) => changedLines.has(line))
  return exactLines.length > 0 ? exactLines : measuredLines
}
