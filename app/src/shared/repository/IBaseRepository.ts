/**
 * Canonical base repository interface.
 *
 * Single source of truth for all repository contracts across every module.
 * Every domain repository interface extends this type.
 *
 * Rules:
 *   - id is generated on create, never supplied by caller
 *   - createdAt is immutable after creation
 *   - update() returns the full updated entity
 */

export interface IBaseRepository<T extends { id: string; createdAt: string; updatedAt: string }> {
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<readonly T[]>;
  count(): Promise<number>;
}
