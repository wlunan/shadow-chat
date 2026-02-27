#!/usr/bin/env node

/**
 * Shadow Chat - 快速启动脚本
 * 
 * 用法:
 *   node init.js
 * 
 * 该脚本验证项目设置并提供后续步骤
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkFile(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

log('===========================================', 'cyan');
log('  Shadow Chat - 项目初始化检查', 'cyan');
log('===========================================', 'cyan');
console.log('');

// 检查必要文件
log('📋 检查项目文件...', 'blue');
const requiredFiles = [
  'package.json',
  'vite.config.js',
  'index.html',
  'src/main.js',
  'src/App.vue',
  'src/services/supabase.js',
  'src/services/chatService.js',
  'src/services/storageService.js',
  'src/utils/user.js',
  'src/utils/time.js',
  'src/components/ChatWindow.vue',
  'src/components/ChatInput.vue',
  'src/components/MessageItem.vue',
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const exists = checkFile(file);
  log(`${exists ? '✅' : '❌'} ${file}`, exists ? 'green' : 'red');
  if (!exists) allFilesExist = false;
});

console.log('');

// 检查环境变量
log('⚙️  检查环境变量...', 'blue');
const envExists = checkFile('.env.local');
const envExampleExists = checkFile('.env.local.example');

log(`${envExists ? '✅' : '⚠️'} .env.local 文件`, envExists ? 'green' : 'yellow');
log(`${envExampleExists ? '✅' : '❌'} .env.local.example 文件`, envExampleExists ? 'green' : 'red');

console.log('');

// 检查依赖
log('📦 检查依赖安装...', 'blue');
const nodeModulesExist = checkFile('node_modules');
log(`${nodeModulesExist ? '✅' : '❌'} node_modules 目录`, nodeModulesExist ? 'green' : 'red');

console.log('');

// 最终状态
log('===========================================', 'cyan');

if (allFilesExist && nodeModulesExist) {
  log('✅ 项目初始化检查通过！', 'green');
  console.log('');
  log('📝 后续步骤:', 'cyan');
  console.log('');
  
  if (!envExists) {
    log('1️⃣ 配置 Supabase 环境变量', 'yellow');
    log('   • 复制 .env.local.example 为 .env.local', 'reset');
    log('   • 在 .env.local 中填入 Supabase 项目的 URL 和 KEY', 'reset');
    log('   • 访问: https://supabase.com 创建项目', 'reset');
    console.log('');
  }
  
  log('2️⃣ 初始化 Supabase 数据库', 'yellow');
  log('   • 打开 Supabase 项目 → SQL Editor', 'reset');
  log('   • 运行 SETUP.md 中提供的 SQL 脚本', 'reset');
  log('   • 创建 Storage Bucket: chat-images', 'reset');
  console.log('');
  
  log('3️⃣ 启动开发服务器', 'yellow');
  log('   npm run dev', 'green');
  console.log('');
  
  log('4️⃣ 开始开发！', 'yellow');
  log('   • 浏览器自动打开 http://localhost:5173', 'reset');
  log('   • 开始聊天，测试文本和图片消息', 'reset');
  console.log('');
  
} else {
  log('❌ 项目初始化检查失败', 'red');
  console.log('');
  log('请执行以下命令:', 'yellow');
  log('   npm install', 'green');
  process.exit(1);
}

log('📚 详细信息请参考:', 'cyan');
log('   • README.md      - 项目概述', 'reset');
log('   • SETUP.md       - 完整安装指南', 'reset');
log('   • QUICKREF.md    - 快速参考卡', 'reset');
log('   • DEVNOTES.md    - 开发备忘录', 'reset');
console.log('');

log('===========================================', 'cyan');
