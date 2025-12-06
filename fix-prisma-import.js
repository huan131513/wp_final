const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules', '@prisma', 'client', 'default.js');

try {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // 執行原本 sed 指令要做的替換
    // s/require('.prisma\/client\/default')/require('.prisma\/client\/index')/g
    const newContent = content.replace(/require\('\.prisma\/client\/default'\)/g, "require('.prisma/client/index')");
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('✅ Successfully patched Prisma Client default.js');
    } else {
        console.log('ℹ️ Content already matches or pattern not found.');
    }
  } else {
    console.warn('⚠️ Prisma Client default.js not found, skipping patch.');
  }
} catch (error) {
  console.error('❌ Error patching Prisma Client:', error);
  process.exit(1);
}

