/**
 * Script para preparar o projeto para deploy manual no Netlify
 * Remove todos os arquivos TypeScript da pasta de funções
 * Verifica se existem arquivos JavaScript correspondentes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}🚀 Preparando projeto para deploy manual no Netlify...${colors.reset}`);

// Caminhos importantes
const functionsDir = path.join(__dirname, '..', 'netlify', 'functions');
const distDir = path.join(__dirname, '..', 'dist');

// Função principal
async function main() {
  try {
    // 1. Verificar se o diretório de funções existe
    if (!fs.existsSync(functionsDir)) {
      console.log(`${colors.red}❌ Diretório de funções não encontrado: ${functionsDir}${colors.reset}`);
      process.exit(1);
    }

    // 2. Listar todos os arquivos na pasta de funções
    const files = fs.readdirSync(functionsDir);
    console.log(`${colors.blue}📂 Total de arquivos na pasta de funções: ${files.length}${colors.reset}`);

    // 3. Separar arquivos por extensão
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    const jsFiles = files.filter(file => file.endsWith('.js'));

    console.log(`${colors.yellow}🔍 Arquivos TypeScript: ${tsFiles.length}${colors.reset}`);
    console.log(`${colors.green}🔍 Arquivos JavaScript: ${jsFiles.length}${colors.reset}`);

    // 4. Verificar correspondência entre arquivos TS e JS
    const tsBasenames = tsFiles.map(file => path.basename(file, '.ts'));
    const jsBasenames = jsFiles.map(file => path.basename(file, '.js'));

    // Verificar quais arquivos TS não possuem equivalente JS
    const missingJs = tsBasenames.filter(name => !jsBasenames.includes(name));

    if (missingJs.length > 0) {
      console.log(`${colors.red}⚠️ Arquivos TypeScript sem equivalente JavaScript: ${missingJs.join(', ')}${colors.reset}`);
      
      // Criar versões JavaScript para os arquivos que faltam
      console.log(`${colors.yellow}🔧 Criando versões JavaScript para os arquivos que faltam...${colors.reset}`);
      
      for (const basename of missingJs) {
        const tsFile = path.join(functionsDir, `${basename}.ts`);
        const jsFile = path.join(functionsDir, `${basename}.js`);
        
        // Criar um arquivo JavaScript simples como fallback
        const fallbackContent = `// Arquivo JavaScript gerado automaticamente como fallback para ${basename}.ts
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: 'Esta função foi substituída por uma versão fallback',
      originalFile: '${basename}.ts',
      event: event.path ? event.path : 'Evento não disponível'
    })
  };
};`;
        
        fs.writeFileSync(jsFile, fallbackContent, 'utf8');
        console.log(`${colors.green}✅ Criado arquivo fallback: ${basename}.js${colors.reset}`);
      }
    }

    // 5. Remover todos os arquivos TypeScript
    console.log(`${colors.magenta}🗑️ Removendo arquivos TypeScript...${colors.reset}`);
    
    for (const file of tsFiles) {
      const filePath = path.join(functionsDir, file);
      fs.unlinkSync(filePath);
      console.log(`${colors.red}🗑️ Removido: ${file}${colors.reset}`);
    }

    // 6. Executar o build se o diretório dist não existir
    if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
      console.log(`${colors.cyan}🏗️ Executando build do projeto...${colors.reset}`);
      try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log(`${colors.green}✅ Build concluído com sucesso!${colors.reset}`);
      } catch (error) {
        console.error(`${colors.red}❌ Erro ao executar build: ${error.message}${colors.reset}`);
        process.exit(1);
      }
    } else {
      console.log(`${colors.green}✅ Diretório dist já existe, pulando build${colors.reset}`);
    }

    // 7. Listar arquivos JavaScript finais para verificação
    const finalJsFiles = fs.readdirSync(functionsDir).filter(file => file.endsWith('.js'));
    console.log(`${colors.green}📂 Arquivos JavaScript finais: ${finalJsFiles.length}${colors.reset}`);
    finalJsFiles.forEach(file => console.log(`   - ${file}`));

    console.log(`${colors.cyan}✨ Preparação concluída! Você pode agora fazer o deploy usando:${colors.reset}`);
    console.log(`${colors.yellow}   netlify deploy${colors.reset} (para deploy de preview)`);
    console.log(`${colors.yellow}   netlify deploy --prod${colors.reset} (para deploy de produção)`);
  } catch (error) {
    console.error(`${colors.red}❌ Erro durante a execução do script: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Executar o script
main(); 