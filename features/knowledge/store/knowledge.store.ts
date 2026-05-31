'use client'

import { create } from 'zustand'
import { KnowledgeAPI, type KnowledgeBaseSummary } from '@/features/knowledge/services/knowledge-api'

interface KnowledgeState {
  knowledgeBases: KnowledgeBaseSummary[]
  isLoading: boolean
  loadKnowledgeBases: () => Promise<void>
  createKnowledgeBase: (name: string, description?: string) => Promise<string>
  deleteKnowledgeBase: (id: string) => Promise<void>
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  isLoading: false,

  loadKnowledgeBases: async () => {
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const { knowledgeBases } = await KnowledgeAPI.list()
      set({ knowledgeBases })
    } finally {
      set({ isLoading: false })
    }
  },

  createKnowledgeBase: async (name, description) => {
    const { knowledgeBase } = await KnowledgeAPI.create(name, description)
    set((state) => ({
      knowledgeBases: [knowledgeBase, ...state.knowledgeBases],
    }))
    return knowledgeBase.id
  },

  deleteKnowledgeBase: async (id) => {
    await KnowledgeAPI.remove(id)
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((base) => base.id !== id),
    }))
  },
}))
