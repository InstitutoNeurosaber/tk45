/**
 * Script para remover arquivos TypeScript da pasta netlify/functions
 * Executado antes do build para evitar problemas com arquivos corrompidos
 */

const fs = require('fs');
const path = require('path');

// Caminho para o diretório de funções do Netlify
const functionsDir = path.join(__dirname, '..', 'netlify', 'functions');

try {
  console.log('🚀 Iniciando limpeza de arquivos TypeScript...');
  
  // Verificar se o diretório existe
  if (!fs.existsSync(functionsDir)) {
    console.log(`❌ Diretório ${functionsDir} não encontrado.`);
    process.exit(0);
  }
  
  // Listar todos os arquivos no diretório
  const files = fs.readdirSync(functionsDir);
  
  // Filtrar apenas arquivos .ts
  const tsFiles = files.filter(file => file.endsWith('.ts'));
  
  if (tsFiles.length === 0) {
    console.log('✅ Nenhum arquivo TypeScript encontrado. Tudo limpo!');
    process.exit(0);
  }
  
  console.log(`🔍 Encontrados ${tsFiles.length} arquivos TypeScript para remover:`);
  
  // Remover cada arquivo .ts
  for (const file of tsFiles) {
    const filePath = path.join(functionsDir, file);
    console.log(`🗑️  Removendo ${file}...`);
    
    try {
      fs.unlinkSync(filePath);
      console.log(`   ✅ ${file} removido com sucesso.`);
    } catch (err) {
      console.error(`   ❌ Erro ao remover ${file}: ${err.message}`);
    }
  }
  
  console.log('🎉 Limpeza concluída! Todos os arquivos TypeScript foram removidos.');
} catch (error) {
  console.error(`❌ Erro durante a execução do script: ${error.message}`);
  process.exit(1);
} 