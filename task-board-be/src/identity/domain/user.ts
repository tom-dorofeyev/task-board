export interface User {
  id: string;
  username: string;
  displayName: string;
}

export interface Session {
  user: User;
  expiresAt: number;
}
