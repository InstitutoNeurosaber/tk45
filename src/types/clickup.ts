export interface ClickUpConfig {
  id: string;
  apiKey: string;
  workspaceId: string;
  spaceId: string;
  listId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  active: boolean;
}

export interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  profilePicture?: string;
}

export interface ClickUpSpace {
  id: string;
  name: string;
}

export interface ClickUpList {
  id: string;
  name: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  assignees: ClickUpUser[];
  dueDate?: string;
  due_date?: number; // Timestamp em milissegundos
  due_date_time?: boolean; // Se true, a data inclui informação de hora
  startDate?: string;
  start_date?: number; // Timestamp em milissegundos
  start_date_time?: boolean; // Se true, a data inclui informação de hora
  time_estimate?: number; // Tempo estimado em milissegundos
  url: string;
}