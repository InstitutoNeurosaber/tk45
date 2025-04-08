/**
 * Configuração para o Netlify CLI
 * Este arquivo é usado pelo netlify-cli durante o deploy manual
 */

module.exports = {
  // Site ID do seu site no Netlify (opcional)
  // site_id: "seu-site-id-netlify",
  
  // Configuração de build
  build: {
    publish: "dist",
    functions: "netlify/functions",
    // Comando de build (já executado pelo script prepare-deploy.js)
    command: "echo 'Build já executado pelo script prepare-deploy.js'"
  },
  
  // Funções 
  functions: {
    directory: "netlify/functions",
    // Usar esbuild como bundler para as funções
    node_bundler: "esbuild",
    // Ignorar arquivos TypeScript
    included_files: ["netlify/functions/*.js"],
    excluded_files: ["netlify/functions/*.ts", "netlify/functions/**/*.ts"]
  },
  
  // Headers para CORS
  headers: [
    {
      for: "/.netlify/functions/*",
      values: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "X-API-Key, Content-Type, Accept, X-Requested-With, Authorization",
        "Cache-Control": "no-cache"
      }
    }
  ],
  
  // Redirecionamentos
  redirects: [
    { from: "/*", to: "/index.html", status: 200 },
    { from: "/api/clickup/webhook", to: "/.netlify/functions/clickup-webhook", status: 200, force: true },
    { from: "/api/webhooks", to: "/.netlify/functions/list-webhooks", status: 200, force: true },
    { from: "/api/webhook-proxy", to: "/.netlify/functions/webhook-proxy", status: 200, force: true },
    { from: "/api/clickup/proxy", to: "/.netlify/functions/clickup-proxy", status: 200, force: true },
    { from: "/api/clickup/config", to: "/.netlify/functions/get-clickup-config", status: 200, force: true },
    { from: "/api/webhook/delete/*", to: "/.netlify/functions/delete-webhook?id=:splat", status: 200, force: true },
    { from: "/api/clickup/status", to: "/.netlify/functions/update-clickup-status", status: 200, force: true },
    { 
      from: "/api/webhook/*", 
      to: "https://webhook.sistemaneurosaber.com.br/webhook/:splat", 
      status: 200, 
      force: true,
      headers: {
        "X-From-Netlify": "true",
        "Forward-Auth": "true",
        "Forward-Host": "true"
      }
    }
  ]
}; 