/**
 * MAGIC Logo Component
 *
 * 设计理念：
 * - 六角星形状代表"Magic"（魔法）
 * - 紫蓝渐变象征神秘与智能
 * - 中心光芒体现 AI 的灵感与创造力
 * - 外围粒子暗示无限可能
 *
 * @module components/icons/MAGICLogo
 */

import * as React from 'react'

interface MAGICLogoProps {
  /** 宽度 */
  width?: number
  /** 高度 */
  height?: number
  /** 类名 */
  className?: string
  /** 是否显示文字 */
  showText?: boolean
}

/**
 * MAGIC Logo 组件
 */
export function MAGICLogo({
  width = 120,
  height = 120,
  className = '',
  showText = false,
}: MAGICLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* 主渐变 - 紫蓝魔法 */}
        <linearGradient id="magicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* 光芒渐变 */}
        <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#C084FC" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </radialGradient>

        {/* 高光渐变 */}
        <linearGradient
          id="highlightGradient"
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* 阴影 */}
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 外发光 */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 背景光晕 */}
      <circle cx="60" cy="55" r="35" fill="url(#glowGradient)" />

      {/* 主图形 - 魔法六角星 */}
      <g filter="url(#shadow)">
        {/* 外层六角星 */}
        <path
          d="M 60 20
             L 68 42 L 92 42
             L 73 56 L 80 78
             L 60 65 L 40 78
             L 47 56 L 28 42
             L 52 42 Z"
          fill="url(#magicGradient)"
        />

        {/* 高光层 */}
        <path
          d="M 60 20
             L 68 42 L 92 42
             L 73 56 L 80 78
             L 60 65 L 40 78
             L 47 56 L 28 42
             L 52 42 Z"
          fill="url(#highlightGradient)"
          opacity="0.4"
        />

        {/* 内部菱形核心 */}
        <path
          d="M 60 36 L 70 50 L 60 62 L 50 50 Z"
          fill="white"
          opacity="0.85"
        />
      </g>

      {/* 装饰粒子/星尘 */}
      <g filter="url(#glow)">
        <circle cx="38" cy="30" r="2" fill="#C084FC" opacity="0.7" />
        <circle cx="85" cy="32" r="1.5" fill="#A855F7" opacity="0.6" />
        <circle cx="28" cy="60" r="1.5" fill="#E9D5FF" opacity="0.5" />
        <circle cx="93" cy="58" r="2" fill="#C084FC" opacity="0.6" />
        <circle cx="45" cy="82" r="1.5" fill="#A855F7" opacity="0.4" />
        <circle cx="78" cy="84" r="1.8" fill="#E9D5FF" opacity="0.5" />
      </g>

      {/* 文字（可选） */}
      {showText && (
        <g>
          <text
            x="60"
            y="100"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="16"
            fontWeight="700"
            fill="url(#magicGradient)"
            textAnchor="middle"
            letterSpacing="2"
          >
            MAGIC
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * MAGIC Logo Icon - 简化版（用于小尺寸）
 */
export function MAGICLogoIcon({
  width = 32,
  height = 32,
  className = '',
}: Omit<MAGICLogoProps, 'showText'>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="iconMagicGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>

      {/* 简化的魔法星 */}
      <path
        d="M 16 4
           L 19 12 L 28 12
           L 21 17 L 24 25
           L 16 20 L 8 25
           L 11 17 L 4 12
           L 13 12 Z"
        fill="url(#iconMagicGradient)"
      />

      {/* 中心高光 */}
      <path
        d="M 16 10 L 19 15.5 L 16 20 L 13 15.5 Z"
        fill="white"
        opacity="0.8"
      />
    </svg>
  )
}
