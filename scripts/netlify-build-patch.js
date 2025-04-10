import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

console.log('🚀 Netlify Build Patch - Iniciando...');

// Função principal
async function main() {
  try {
    const functionsDir = join(process.cwd(), 'netlify', 'functions');
    const tempDir = join(process.cwd(), 'netlify', 'functions-ts-backup');
    
    // Verificar se o diretório de funções existe
    if (!existsSync(functionsDir)) {
      console.log('❌ Diretório de funções não encontrado:', functionsDir);
      return;
    }
    
    // Criar diretório temporário se não existir
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
      console.log('✅ Diretório temporário criado:', tempDir);
    }
    
    // Obter todos os arquivos TypeScript
    const files = readdirSync(functionsDir);
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    
    if (tsFiles.length === 0) {
      console.log('✅ Nenhum arquivo TypeScript encontrado em:', functionsDir);
      return;
    }
    
    console.log(`🔍 Encontrados ${tsFiles.length} arquivos TypeScript para mover`);
    
    // Mover cada arquivo TypeScript para o diretório temporário
    for (const file of tsFiles) {
      const srcPath = join(functionsDir, file);
      const destPath = join(tempDir, file);
      
      try {
        // Ler o arquivo original
        const fileContent = readFileSync(srcPath);
        
        // Escrever no diretório temporário
        writeFileSync(destPath, fileContent);
        console.log(`✅ Backup criado: ${file}`);
        
        // Remover o arquivo original
        unlinkSync(srcPath);
        console.log(`🗑️ Arquivo original removido: ${file}`);
      } catch (err) {
        console.error(`❌ Erro ao processar arquivo ${file}:`, err);
      }
    }
    
    console.log('🎉 Processo concluído com sucesso!');
    
    // Listar arquivos restantes na pasta de funções
    console.log('📁 Arquivos restantes na pasta de funções:');
    const remainingFiles = readdirSync(functionsDir);
    remainingFiles.forEach(file => console.log(`- ${file}`));
    
  } catch (error) {
    console.error('❌ Erro durante a execução do script:', error);
  }
}

// Executar script
main()
  .then(() => console.log('🏁 Script finalizado'))
  .catch(err => console.error('❌ Erro fatal:', err)); 