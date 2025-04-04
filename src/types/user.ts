export interface UserProfile {
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  department?: string;
  position?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date | null;
  profile?: UserProfile;
}

export type UserData = User;

export const roleLabels: Record<User['role'], string> = {
  admin: 'Administrador',
  user: 'Usuário'
};