import { prisma } from '@/server/db/client'
import type { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export const KnowledgeRepository = {
  async listBases(userId: string) {
    return prisma.knowledgeBase.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            documents: true,
            chunks: true,
          },
        },
      },
    })
  },

  async createBase(userId: string, name: string, description?: string) {
    return prisma.knowledgeBase.create({
      data: { userId, name, description },
    })
  },

  async updateBase(userId: string, id: string, data: { name?: string; description?: string | null }) {
    const result = await prisma.knowledgeBase.updateMany({
      where: { id, userId },
      data,
    })
    return result.count > 0
  },

  async deleteBase(userId: string, id: string) {
    const result = await prisma.knowledgeBase.deleteMany({
      where: { id, userId },
    })
    return result.count > 0
  },

  async findBase(userId: string, id: string) {
    return prisma.knowledgeBase.findFirst({
      where: { id, userId },
    })
  },

  async listDocuments(userId: string, knowledgeBaseId: string) {
    return prisma.knowledgeDocument.findMany({
      where: { userId, knowledgeBaseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        knowledgeBaseId: true,
        fileName: true,
        mimeType: true,
        size: true,
        status: true,
        errorMessage: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  },

  async deleteDocument(userId: string, id: string) {
    const result = await prisma.knowledgeDocument.deleteMany({
      where: { id, userId },
    })
    return result.count > 0
  },

  async createDocumentWithChunks(input: {
    userId: string
    knowledgeBaseId: string
    fileName: string
    mimeType?: string
    size?: number
    contentHash: string
    rawText: string
    chunks: Array<{
      content: string
      chunkIndex: number
      heading?: string
      tokenCount: number
      metadata: Prisma.InputJsonValue
      embedding: number[]
    }>
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeDocument.findFirst({
        where: {
          knowledgeBaseId: input.knowledgeBaseId,
          contentHash: input.contentHash,
        },
      })

      if (existing) {
        await tx.knowledgeChunk.deleteMany({ where: { documentId: existing.id } })
        await tx.knowledgeDocument.delete({ where: { id: existing.id } })
      }

      const document = await tx.knowledgeDocument.create({
        data: {
          knowledgeBaseId: input.knowledgeBaseId,
          userId: input.userId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          size: input.size,
          contentHash: input.contentHash,
          rawText: input.rawText,
          status: 'ready',
          chunkCount: input.chunks.length,
        },
      })

      for (const chunk of input.chunks) {
        const chunkId = randomUUID()
        await tx.$executeRaw`
          INSERT INTO "KnowledgeChunk"
            ("id", "documentId", "knowledgeBaseId", "userId", "chunkIndex", "content", "heading", "tokenCount", "metadata", "embedding", "createdAt")
          VALUES
            (
              ${chunkId},
              ${document.id},
              ${input.knowledgeBaseId},
              ${input.userId},
              ${chunk.chunkIndex},
              ${chunk.content},
              ${chunk.heading ?? null},
              ${chunk.tokenCount},
              ${JSON.stringify(chunk.metadata)}::jsonb,
              ${JSON.stringify(chunk.embedding)}::vector,
              NOW()
            )
        `
      }

      await tx.knowledgeBase.update({
        where: { id: input.knowledgeBaseId },
        data: { updatedAt: new Date() },
      })

      return document
    }, {
      timeout: 60000,
    })
  },
}
