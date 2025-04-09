# Instruções para Deploy Manual no Netlify

Este documento contém instruções detalhadas sobre como realizar um deploy manual no Netlify para resolver problemas com arquivos TypeScript que contêm caracteres BOM (Byte Order Mark).

## Problema

Os arquivos TypeScript na pasta `netlify/functions` contêm caracteres BOM invisíveis (`\xff`) que causam erros durante o processo de build automático do Netlify:

```
Unexpected "\xff" in netlify/functions/xxx.ts
```

## Solução

Fazer um deploy manual usando o Netlify CLI, removendo os arquivos TypeScript problemáticos antes do deploy.

## Pré-requisitos

1. Netlify CLI instalado:
   ```bash
   npm install -g netlify-cli
   ```

2. Estar logado no Netlify CLI:
   ```bash
   netlify login
   ```

## Passos para Deploy

### 1. Preparar o Ambiente

Antes de fazer o deploy, é necessário preparar o ambiente:

```bash
# Execute o script que remove arquivos TypeScript problemáticos
node scripts/prepare-deploy.js
```

Este script:
- Remove todos os arquivos TypeScript da pasta `netlify/functions`
- Verifica se existem arquivos JavaScript correspondentes
- Cria arquivos JavaScript de fallback para funções sem equivalentes
- Executa o build do projeto, se necessário

### 2. Vincular ao Site do Netlify

Se ainda não estiver vinculado ao site:

```bash
# Listar sites disponíveis
netlify sites:list

# Vincular ao site desejado (substitua SITE_ID pelo ID correto)
netlify link --id 435f71be-7bc6-483c-abe6-aa8192083f94
```

### 3. Deploy de Preview (teste)

Para fazer um deploy de preview e testar antes de aplicar em produção:

```bash
netlify deploy
```

Verifique se tudo está funcionando corretamente no URL de preview fornecido.

### 4. Deploy de Produção

Quando estiver satisfeito com o preview, faça o deploy para produção:

```bash
netlify deploy --prod
```

## Solução de Problemas

### Erro com o arquivo de configuração

Se encontrar erros relacionados ao arquivo de configuração do Netlify:

1. Verifique se o arquivo `netlify.toml` foi removido ou está com a sintaxe correta
2. Certifique-se de que o arquivo `netlify.js` está configurado corretamente

### Arquivos TypeScript ainda presentes

Se ainda houver problemas com arquivos TypeScript:

1. Verifique manualmente se existem arquivos TypeScript na pasta `netlify/functions`
2. Remova manualmente qualquer arquivo TypeScript encontrado
3. Execute novamente o script `prepare-deploy.js`

## Automação para o Futuro

Para evitar esse problema no futuro, é recomendável:

1. Adicionar `netlify/functions/*.ts` e `netlify/functions/**/*.ts` ao `.gitignore`
2. Configurar um processo de build que compile TypeScript para JavaScript antes do deploy
3. Manter apenas as versões JavaScript das funções no repositório

## Links Úteis

- [Documentação do Netlify CLI](https://docs.netlify.com/cli/get-started/)
- [Configuração de funções no Netlify](https://docs.netlify.com/functions/get-started/)
- [Solução de problemas de build](https://docs.netlify.com/configure-builds/troubleshooting-tips/) 