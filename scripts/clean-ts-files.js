import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function cleanTypeScriptFiles() {
  try {
    const functionsDir = join(dirname(__dirname), 'netlify', 'functions');
    
    // Verificar se o diretório existe
    try {
      await fs.access(functionsDir);
    } catch (error) {
      console.log('Diretório de funções não encontrado:', functionsDir);
      return;
    }

    // Listar todos os arquivos
    const files = await fs.readdir(functionsDir);
    
    // Filtrar apenas arquivos .ts
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    
    if (tsFiles.length === 0) {
      console.log('Nenhum arquivo TypeScript encontrado para remover.');
      return;
    }

    console.log(`Encontrados ${tsFiles.length} arquivos TypeScript para remover.`);

    // Remover cada arquivo .ts
    for (const file of tsFiles) {
      const filePath = join(functionsDir, file);
      try {
        await fs.unlink(filePath);
        console.log(`Removido: ${file}`);
      } catch (error) {
        console.error(`Erro ao remover ${file}:`, error);
      }
    }

    console.log('Limpeza concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a limpeza:', error);
    process.exit(1);
  }
}

cleanTypeScriptFiles(); 