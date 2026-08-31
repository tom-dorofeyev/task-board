import type { Task } from '../../domain/task.js'

const seedTasks: Task[] = [
  {
    id: 'task-101',
    key: 'NEX-101',
    title: 'Map the onboarding journey',
    description:
      'Document the first-run experience and identify the biggest points of friction.',
    status: 'todo',
    priority: 'high',
    assignee: 'Maya Chen',
    labels: ['Research', 'UX'],
    position: 0,
  },
  {
    id: 'task-102',
    key: 'NEX-102',
    title: 'Draft empty states',
    description:
      'Create useful guidance for empty projects and filtered views.',
    status: 'todo',
    priority: 'medium',
    assignee: 'Noah Williams',
    labels: ['Design'],
    position: 1,
  },
  {
    id: 'task-103',
    key: 'NEX-103',
    title: 'Build notification preferences',
    description:
      'Add the controls used to tune email and in-app notifications.',
    status: 'in-progress',
    priority: 'high',
    assignee: 'Olivia Martin',
    labels: ['Frontend'],
    position: 0,
  },
  {
    id: 'task-104',
    key: 'NEX-104',
    title: 'Review accessibility audit',
    description:
      'Triage the latest audit and schedule fixes for priority findings.',
    status: 'in-progress',
    priority: 'medium',
    assignee: 'Ethan Brooks',
    labels: ['A11y', 'Quality'],
    position: 1,
  },
  {
    id: 'task-105',
    key: 'NEX-105',
    title: 'Publish release notes',
    description: 'Summarize improvements in the August workspace release.',
    status: 'done',
    priority: 'low',
    assignee: 'Maya Chen',
    labels: ['Content'],
    position: 0,
  },
]

export function createSeedTasks(): Task[] {
  return seedTasks.map((task) => ({ ...task, labels: [...task.labels] }))
}
