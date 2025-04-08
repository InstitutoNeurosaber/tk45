/**
 * Configuração específica para o Netlify
 * Executa antes da compilação para remover arquivos TypeScript problemáticos
 */

// Este arquivo é carregado automaticamente pelo Netlify
module.exports = {
  onPreBuild: ({ utils }) => {
    // Registrar início
    console.log('🚀 Executando hook onPreBuild para remover arquivos TypeScript...');
    
    try {
      // Executa comandos shell para remover arquivos TypeScript
      const result = utils.run.command('rm -f netlify/functions/*.ts');
      console.log('✅ Remoção de arquivos TS concluída:', result);
      
      // Encontrar e remover todos os arquivos TypeScript em subdiretórios
      const result2 = utils.run.command('find netlify/functions -name "*.ts" -type f -delete || true');
      console.log('✅ Remoção de arquivos TS em subdiretórios concluída:', result2);
      
      // Listar arquivos restantes
      const files = utils.run.command('ls -la netlify/functions');
      console.log('📁 Arquivos restantes na pasta de funções:');
      console.log(files);
    } catch (error) {
      // Registrar erro, mas continuar o build
      console.error('❌ Erro ao remover arquivos TypeScript:', error);
      console.log('⚠️ Continuando o build mesmo com erro...');
    }
  }
}; 