import { Role, type AuthUser } from "@/auth/types";

export class UserStore {
  private readonly users = new Map<number, AuthUser>();

  constructor(
    private readonly ownerId: number,
    adminIds: number[],
  ) {
    this.users.set(ownerId, { id: ownerId, username: undefined, firstName: "Owner", role: Role.Owner });

    for (const id of adminIds) {
      if (id !== ownerId) {
        this.users.set(id, { id, username: undefined, firstName: "Admin", role: Role.Admin });
      }
    }
  }

  getUser(id: number): AuthUser | undefined {
    return this.users.get(id);
  }

  setUser(user: AuthUser): void {
    this.users.set(user.id, user);
  }

  addAdmin(id: number, firstName: string, username?: string): boolean {
    if (this.users.has(id)) return false;
    this.users.set(id, { id, username, firstName, role: Role.Admin });
    return true;
  }

  removeUser(id: number): boolean {
    if (id === this.ownerId) return false;
    return this.users.delete(id);
  }

  hasUser(id: number): boolean {
    return this.users.has(id);
  }

  isOwner(id: number): boolean {
    return id === this.ownerId;
  }

  getRole(id: number): Role | undefined {
    return this.users.get(id)?.role;
  }

  getAdmins(): AuthUser[] {
    const result: AuthUser[] = [];
    for (const user of this.users.values()) {
      if (user.role === Role.Admin) result.push(user);
    }
    return result;
  }

  getAllUsers(): AuthUser[] {
    return [...this.users.values()];
  }
}
