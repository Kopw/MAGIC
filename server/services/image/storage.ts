/**
 * 图片存储服务
 *
 * 使用 Vercel Blob 存储生成的图片
 * Vercel 的 serverless 环境文件系统只读，不能使用本地文件系统
 */

import { put } from '@vercel/blob'
import { randomBytes } from 'crypto'

/**
 * 存储的图片信息
 */
export interface StoredImage {
  /** Blob 访问 URL */
  localUrl: string
  /** 文件名 */
  filename: string
}

/**
 * 生成唯一文件名
 *
 * 格式: {timestamp}-{randomId}.png
 */
export function generateFilename(): string {
  const timestamp = Date.now()
  const randomId = randomBytes(4).toString('hex')
  return `${timestamp}-${randomId}.png`
}

/**
 * 下载远程图片并上传到 Vercel Blob
 *
 * @param remoteUrl - 远程图片 URL（SiliconFlow 临时 URL）
 * @returns 存储的图片信息（包含永久 Blob URL）
 * @throws Error 当下载或上传失败时
 */
export async function downloadAndSave(remoteUrl: string): Promise<StoredImage> {
  // 下载图片
  const response = await fetch(remoteUrl)

  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 生成文件名
  const filename = generateFilename()

  // 上传到 Vercel Blob
  const blob = await put(`generated/${filename}`, buffer, {
    access: 'public',
    contentType: 'image/png',
  })

  return {
    localUrl: blob.url,
    filename,
  }
}
