import { z } from "zod";

/**
 * An entity with standard methods
 */
export type Entity<T> = T & {
  /**
   * Compares this entity with another for equality
   */
  equals: (other: unknown) => boolean;

  /**
   * Returns a string representation of the entity
   */
  toString: () => string;

  [key: string]: unknown;
}

/**
 * Represents all properties in T as optional
 */
export type PartialOf<T> = {
  [P in keyof T]?: T[P];
};

/**
 * A factory for creating and managing entities
 */
export type EntityFactory<SchemaType extends z.ZodType, T> = {
  /**
   * Creates a new instance of the entity
   */
  create: (data: T) => Entity<T>;

  /**
   * Updates an entity with new values while preserving its identity
   */
  update: (entity: Entity<T>, updates: PartialOf<T>) => Entity<T>;

  /**
   * The schema used for validation
   */
  schema: SchemaType;

  /**
   * The field used as identity
   */
  identity: string;

  /**
   * Creates an extended version of this entity with additional functionality
   */
  extend: <NewSchemaType extends z.ZodType = SchemaType, NewT = T>(options: {
    name: string;
    schema?: (schema: SchemaType) => NewSchemaType;
    methodsFactory: (factory: EntityFactory<SchemaType, T>) => Record<string, Function>;
    identity?: string;
    historize?: boolean;
  }) => EntityFactory<NewSchemaType, NewT>;
}

/**
 * Defines the structure of methods that will be bound to an entity instance
 */
export type EntityMethods<T> = Record<string, (this: T, ...args: any[]) => any>;

/**
 * Creates an entity factory
 *
 * Entities in Domain-Driven Design are:
 * 1. Defined by their identity, not their attributes
 * 2. Mutable - their state can change over time
 * 3. Have a lifecycle - they can be created, updated, and deleted
 * 4. Encapsulate domain logic and business rules
 */
export function entity<SchemaType extends z.ZodType, T = z.infer<SchemaType>>(options: {
  /**
   * Name of the entity
   */
  name: string;

  /**
   * Zod schema for validation
   */
  schema: SchemaType;

  /**
   * Field name that serves as the identity
   */
  identity: string;

  /**
   * Factory function that creates methods that will be bound to the entity instance
   * The `this` context inside these methods will be the entity instance
   */
  methodsFactory: (factory: EntityFactory<SchemaType, T>) => EntityMethods<T & Entity<T>>;

  /**
   * Whether to track state changes
   */
  historize?: boolean;
}): EntityFactory<SchemaType, T>;
