#!/bin/bash

# ============================================
# MAGIC 生产环境启动脚本
# ============================================

set -e

echo "🚀 MAGIC 生产环境启动"
echo "======================================"
echo ""

# 1. 运行部署检查
echo "📋 步骤 1/5: 运行部署检查..."
chmod +x scripts/deploy-check.sh
./scripts/deploy-check.sh

if [ $? -ne 0 ]; then
  echo "❌ 部署检查失败，请修复错误后重试"
  exit 1
fi
echo ""

# 2. 安装依赖
echo "📦 步骤 2/5: 安装依赖..."
pnpm install --frozen-lockfile --prod=false
echo "✅ 依赖安装完成"
echo ""

# 3. 生成 Prisma Client
echo "🔧 步骤 3/5: 生成 Prisma Client..."
pnpm run db:generate
echo "✅ Prisma Client 生成完成"
echo ""

# 4. 运行数据库迁移
echo "🗄️  步骤 4/5: 运行数据库迁移..."
pnpm run db:migrate
echo "✅ 数据库迁移完成"
echo ""

# 5. 构建应用
echo "🏗️  步骤 5/5: 构建应用..."
pnpm run build
echo "✅ 应用构建完成"
echo ""

# 启动应用
echo "======================================"
echo "🎉 准备就绪！启动应用..."
echo "======================================"
echo ""

# 使用 PM2 启动（如果已安装）
if command -v pm2 &> /dev/null; then
  echo "使用 PM2 启动应用..."
  pm2 start pnpm --name sky-chat -- start
  pm2 save
  echo ""
  echo "✅ 应用已启动！"
  echo ""
  echo "管理命令："
  echo "  - 查看日志: pm2 logs sky-chat"
  echo "  - 重启应用: pm2 restart sky-chat"
  echo "  - 停止应用: pm2 stop sky-chat"
  echo "  - 查看状态: pm2 status"
else
  echo "直接启动应用..."
  echo ""
  echo "⚠️  建议安装 PM2 进行进程管理："
  echo "   npm install -g pm2"
  echo ""
  pnpm start
fi

