/**
 * Script para remover BOM (Byte Order Mark) dos arquivos TypeScript
 * O BOM é o caractere \xFF\xFE que causa erros de compilação
 */

const fs = require('fs');
const path = require('path');

// Diretório de funções do Netlify
const functionsDir = path.join(__dirname, '..', 'netlify', 'functions');

console.log('🧹 Iniciando limpeza de BOM em arquivos TypeScript...');

// Verificar se o diretório existe
if (!fs.existsSync(functionsDir)) {
  console.log(`❌ Diretório ${functionsDir} não encontrado`);
  process.exit(0);
}

// Listar arquivos TypeScript
const tsFiles = fs.readdirSync(functionsDir)
  .filter(file => file.endsWith('.ts'));

if (tsFiles.length === 0) {
  console.log('✅ Nenhum arquivo TypeScript encontrado');
  process.exit(0);
}

console.log(`🔍 Encontrados ${tsFiles.length} arquivos TypeScript para verificar`);

// Processar cada arquivo
for (const file of tsFiles) {
  const filePath = path.join(functionsDir, file);
  console.log(`📄 Verificando ${file}...`);
  
  try {
    // Ler o arquivo como buffer para detectar BOM
    const buffer = fs.readFileSync(filePath);
    
    // Verificar se o arquivo começa com BOM
    const hasBOM = buffer.length >= 3 && 
                  buffer[0] === 0xEF && 
                  buffer[1] === 0xBB && 
                  buffer[2] === 0xBF;
    
    if (hasBOM) {
      console.log(`🔴 BOM detectado em ${file}, removendo...`);
      
      // Remover BOM (primeiros 3 bytes) e escrever o arquivo novamente
      const cleanBuffer = buffer.slice(3);
      fs.writeFileSync(filePath, cleanBuffer);
      
      console.log(`✅ BOM removido de ${file}`);
    } else {
      const hasInvisibleChars = buffer.length > 0 && 
                               (buffer[0] === 0xFF || 
                                buffer[0] === 0xFE || 
                                buffer[0] > 127);
      
      if (hasInvisibleChars) {
        console.log(`🔴 Caracteres invisíveis detectados em ${file}, removendo...`);
        
        // Converte o buffer para string, removendo caracteres inválidos
        let content = buffer.toString('utf8');
        content = content.replace(/^\uFEFF/, ''); // Remove BOM Unicode
        
        // Escrever arquivo limpo
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`✅ Caracteres invisíveis removidos de ${file}`);
      } else {
        console.log(`✅ ${file} não contém BOM ou caracteres invisíveis`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Erro ao processar ${file}: ${error.message}`);
  }
}

console.log('🎉 Processo de limpeza concluído!'); 