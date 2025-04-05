import { TicketStatus, TicketPriority } from '../../types/ticket';

/**
 * Serviço para mapear status e prioridades entre o sistema de tickets e o ClickUp
 * Centraliza toda a lógica de mapeamento para manter consistência
 */
export class StatusMapper {
  /**
   * Mapeia o status do sistema para o formato do ClickUp
   */
  mapSystemToClickUp(status: TicketStatus): string {
    console.log(`[StatusMapper] ⚠️ Mapeando status do sistema: ${status} para ClickUp`);
    
    // Mapeamento direto sem transformações
    const statusMap: Record<TicketStatus, string> = {
      'open': 'aberto',
      'in_progress': 'em andamento',
      'resolved': 'resolvido',
      'closed': 'fechado'
    };

    const clickupStatus = statusMap[status];
    console.log(`[StatusMapper] Status mapeado: ${status} -> ${clickupStatus}`);

    if (!clickupStatus) {
      console.error(`[StatusMapper] ❌ Status não mapeado: ${status}`);
      throw new Error(`Status "${status}" não tem mapeamento para o ClickUp`);
    }

    return clickupStatus;
  }

  /**
   * Mapeia o status do ClickUp para o formato do sistema
   */
  mapClickUpToSystem(clickupStatus: string): TicketStatus {
    console.log(`[StatusMapper] ⚠️ Mapeando status do ClickUp: ${clickupStatus} para o sistema`);
    
    // Normalizar o status (remover acentos, converter para minúsculas)
    const normalizedStatus = clickupStatus.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    console.log(`[StatusMapper] Status normalizado: ${normalizedStatus}`);

    // Mapeamento direto
    const statusMap: Record<string, TicketStatus> = {
      'aberto': 'open',
      'em andamento': 'in_progress',
      'resolvido': 'resolved',
      'fechado': 'closed'
    };

    // Tentar encontrar o status exato primeiro
    for (const [clickup, system] of Object.entries(statusMap)) {
      if (normalizedStatus === clickup.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
        console.log(`[StatusMapper] ✓ Status encontrado exatamente: ${clickup} -> ${system}`);
        return system;
      }
    }

    // Se não encontrou exato, tentar correspondência parcial
    for (const [clickup, system] of Object.entries(statusMap)) {
      const normalizedClickup = clickup.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedStatus.includes(normalizedClickup) || normalizedClickup.includes(normalizedStatus)) {
        console.log(`[StatusMapper] ✓ Status encontrado por correspondência parcial: ${clickup} -> ${system}`);
        return system;
      }
    }

    // Se ainda não encontrou, usar fallbacks comuns
    if (normalizedStatus.includes('to do') || normalizedStatus.includes('open')) {
      return 'open';
    } else if (normalizedStatus.includes('progress') || normalizedStatus.includes('working')) {
      return 'in_progress';
    } else if (normalizedStatus.includes('done') || normalizedStatus.includes('complete')) {
      return 'resolved';
    } else if (normalizedStatus.includes('cancel')) {
      return 'closed';
    }

    // Se não encontrou nenhuma correspondência
    console.error(`[StatusMapper] ❌ Status não reconhecido: ${clickupStatus}`);
    throw new Error(`Status do ClickUp não reconhecido: ${clickupStatus}`);
  }

  /**
   * Mapeia a prioridade do sistema para o formato do ClickUp
   */
  mapPriorityToClickUp(priority: TicketPriority): number {
    switch (priority) {
      case 'low':
        return 3;
      case 'medium':
        return 2;
      case 'high':
        return 1;
      case 'critical':
        return 4;
      default:
        return 2; // Médio como padrão
    }
  }

  /**
   * Mapeia a prioridade do ClickUp para o formato do sistema
   */
  mapClickUpPriorityToSystem(priorityLevel: number): TicketPriority {
    switch (priorityLevel) {
      case 1:
        return 'high';
      case 2:
        return 'medium';
      case 3:
        return 'low';
      case 4:
        return 'critical';
      default:
        return 'medium';
    }
  }

  /**
   * Verifica se um status do ClickUp existe e é válido
   */
  isValidClickUpStatus(status: string): boolean {
    const validStatuses = ['aberto', 'em andamento', 'resolvido', 'fechado'];
    const normalizedStatus = status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return validStatuses.some(validStatus => {
      const normalizedValid = validStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalizedStatus === normalizedValid;
    });
  }

  /**
   * Retorna lista de status necessários no ClickUp para a integração funcionar
   */
  getRequiredClickUpStatuses(): string[] {
    return ['aberto', 'em andamento', 'resolvido', 'fechado'];
  }
}

// Exportar instância única para uso em toda a aplicação
export const statusMapper = new StatusMapper(); 