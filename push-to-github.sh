#!/bin/bash
# Career Copilot CN — GitHub 一键推送脚本
# 用法: GITHUB_TOKEN=your_token bash push-to-github.sh

set -e

cd "$(dirname "$0")"

echo "=== Career Copilot CN — 推送到 GitHub ==="

if [ -z "$GITHUB_TOKEN" ]; then
  echo "错误: 请先设置 GITHUB_TOKEN 环境变量"
  echo "用法: GITHUB_TOKEN=ghp_xxx bash push-to-github.sh"
  exit 1
fi

# 配置 git 身份
git config user.email "tan19991103@outlook.com"
git config user.name "ptan853"

# 使用环境变量中的 token 设置远程仓库
git remote set-url origin "https://ptan853:${GITHUB_TOKEN}@github.com/ptan853/career-copilot-cn.git"

# 推送到 main 分支
echo "正在推送到 GitHub..."
git push -u origin main

echo ""
echo "✓ 推送成功！"
echo "  仓库地址: https://github.com/ptan853/career-copilot-cn"
