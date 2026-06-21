import type { AiSuggestion, ChatMessage, Credits, Interview, User } from '@/types'

export const mockUser: User = {
  id: 'usr_001',
  name: 'Madhav Atatikonda',
  email: 'madhav@example.com',
  role: 'Frontend Engineer',
  avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Madhav%20Atatikonda',
}

export const mockCredits: Credits = {
  remaining: 18,
  used: 12,
  monthlyLimit: 30,
}

export const mockInterviews: Interview[] = [
  {
    id: 'int_101',
    company: 'TCS',
    role: 'Vue Developer',
    date: '2026-06-23',
    time: '10:00',
    duration: 45,
    type: 'Technical',
    meetingLink: 'https://meet.example.com/tcs-vue',
    resumeName: 'madhav-frontend-resume.pdf',
    jobDescriptionName: 'tcs-vue-role.pdf',
    jobDescription: 'Vue 3, state management, component design, and REST API integration.',
    status: 'scheduled',
  },
  {
    id: 'int_102',
    company: 'Infosys',
    role: 'Senior Frontend Engineer',
    date: '2026-06-25',
    time: '14:00',
    duration: 60,
    type: 'System Design',
    meetingLink: 'https://meet.example.com/infosys-fe',
    resumeName: 'madhav-frontend-resume.pdf',
    jobDescriptionName: 'infosys-senior-fe.txt',
    jobDescription: 'Architecture, performance, accessibility, and design-system collaboration.',
    status: 'scheduled',
  },
  {
    id: 'int_103',
    company: 'Wipro',
    role: 'React Engineer',
    date: '2026-06-12',
    time: '11:30',
    duration: 50,
    type: 'Technical',
    meetingLink: 'https://meet.example.com/wipro-react',
    resumeName: 'madhav-frontend-resume.pdf',
    jobDescriptionName: 'wipro-react-role.docx',
    jobDescription: 'React, testing, performance optimization, and micro-frontends.',
    status: 'completed',
    score: 82,
  },
]

export const mockChatHistory: ChatMessage[] = [
  {
    id: 'msg_001',
    interviewId: 'int_101',
    role: 'candidate',
    content: 'Can you explain how you manage shared state in Vue 3?',
    createdAt: '2026-06-19T10:00:00.000Z',
  },
  {
    id: 'msg_002',
    interviewId: 'int_101',
    role: 'assistant',
    content: 'Use Pinia for app-level state, composables for reusable local logic, and component props for explicit parent-child data flow.',
    createdAt: '2026-06-19T10:00:04.000Z',
  },
]

export const mockSuggestions: AiSuggestion[] = [
  {
    id: 'sug_001',
    interviewId: 'int_101',
    title: 'State Management Answer',
    content: 'Start with the decision criteria: local refs for component state, composables for reusable logic, and Pinia for cross-route business state. Mention devtools, typing, and testability.',
    confidence: 94,
  },
  {
    id: 'sug_002',
    interviewId: 'int_101',
    title: 'Performance Follow-up',
    content: 'Highlight code splitting, computed memoization, shallow refs for large objects, and measuring first with browser performance tools.',
    confidence: 89,
  },
]
