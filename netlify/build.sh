#!/bin/bash

# Script para limpeza de arquivos TypeScript com BOM (Byte Order Mark)
# Executado antes do build no Netlify

echo "🧹 Iniciando limpeza de arquivos TypeScript..."

# Remover todos os arquivos TypeScript na pasta de funções
rm -f netlify/functions/*.ts || true
echo "✅ Arquivos TypeScript na raiz removidos"

# Encontrar e remover arquivos TypeScript em subdiretórios
find netlify/functions -name "*.ts" -type f -delete || true
echo "✅ Arquivos TypeScript em subdiretórios removidos"

# Listar arquivos restantes na pasta de funções
echo "📁 Arquivos restantes na pasta de funções:"
ls -la netlify/functions

# Verificar se existem arquivos JavaScript correspondentes
echo "📄 Verificando arquivos JavaScript disponíveis:"
ls -la netlify/functions/*.js || echo "Nenhum arquivo JavaScript encontrado"

# Executar o build normal
echo "🚀 Executando o build normal..."
npm run build

# Instalar dependências das funções do Netlify
echo "📦 Instalando dependências das funções do Netlify..."
cd netlify/functions && npm install

echo "✨ Processo concluído com sucesso!" 