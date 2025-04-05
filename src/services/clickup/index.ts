// Exportar todos os serviços do ClickUp a partir de um único ponto
import { statusMapper } from './statusMapper';
import { taskService } from './taskService';
import { syncService } from './syncService';
import { clickupStatusSync } from './statusSync';

// Re-exportar tudo para facilitar o uso
export {
  statusMapper,
  taskService,
  syncService,
  clickupStatusSync
};

// Para backward compatibility (caso ainda existam referências ao serviço antigo)
import { clickupService } from '../clickupService';
export { 
  clickupService 
}; 