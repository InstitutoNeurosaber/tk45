# Deploy Manual para o Netlify

Este guia explica como fazer um deploy manual deste projeto no Netlify usando o CLI, contornando problemas com arquivos TypeScript na pasta de funções.

## Pré-requisitos

1. Certifique-se de ter o Netlify CLI instalado globalmente:
   ```bash
   npm install -g netlify-cli
   ```

2. Faça login no Netlify CLI:
   ```bash
   netlify login
   ```

## Processo de Deploy

### Método Automatizado (Recomendado)

Utilize os scripts já configurados no `package.json`:

1. Para deploy de preview (ambiente de testes):
   ```bash
   npm run deploy:preview
   ```

2. Para deploy de produção:
   ```bash
   npm run deploy:prod
   ```

Estes comandos fazem o seguinte:
- Executam o script `prepare-deploy.js` que:
  - Remove arquivos TypeScript da pasta `netlify/functions`
  - Verifica se existem arquivos JavaScript correspondentes
  - Cria arquivos JavaScript fallback para funções que não têm equivalentes
  - Executa o build do projeto se necessário
- Executa o comando `netlify deploy` para fazer o deploy

### Método Manual (Passo a passo)

Se preferir fazer manualmente, siga estes passos:

1. Prepare o projeto para deploy:
   ```bash
   npm run prepare-deploy
   ```

2. Faça o deploy:
   - Para preview:
     ```bash
     netlify deploy
     ```
   - Para produção:
     ```bash
     netlify deploy --prod
     ```

## Troubleshooting

### Problema com funções TypeScript

Se encontrar erros relacionados a caracteres BOM em arquivos TypeScript, como:
```
Unexpected "\xff" in netlify/functions/xxx.ts
```

Certifique-se de:
1. Executar o script `prepare-deploy.js` antes do deploy
2. Verificar se todos os arquivos TypeScript foram removidos
3. Confirmar que existem versões JavaScript de todas as funções

### Site ID não encontrado

Se encontrar erros relacionados ao Site ID, preencha o campo `site_id` no arquivo `netlify.js` 
com o ID do seu site do Netlify, que pode ser encontrado na URL do seu site no Netlify:
```
https://app.netlify.com/sites/[SITE-ID]/overview
```

### Ambiente diferente de produção

Defina variáveis de ambiente no seu site Netlify usando o dashboard do Netlify.
Acesse:
```
https://app.netlify.com/sites/[SITE-ID]/settings/env
``` 