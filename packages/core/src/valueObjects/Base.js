import { z } from "zod";
import { ValidationError } from "../errors/index.js";

/**
 * @template T
 * @typedef {T & {
 *   equals: (other: any) => boolean,
 *   toString: () => string,
 *   valueOf: () => any,
 *   [key: string]: any
 * }} ValueObject<T>
 */

/**
 * @template T
 * @typedef {Object} ValueObjectFactory
 * @property {(data: any) => ValueObject<T>} create - Creates a new instance of the value object
 * @property {z.ZodSchema} schema - The Zod schema used for validation
 * @property {(options: {name: string, schema?: Function, methodsFactory: Function}) => ValueObjectFactory<any>} extend - Creates an extended version of this value object
 */

/**
 * Creates a value object factory
 *
 * Value objects in Domain-Driven Design are:
 * 1. Defined by their attributes, not an identity
 * 2. Immutable - any modification creates a new instance
 * 3. Comparable by value - two instances with the same attributes are equal
 *
 * @template {z.ZodType} SchemaType
 * @param {object} options - Value object configuration
 * @param {string} options.name - Name of the value object
 * @param {SchemaType} options.schema - Zod schema for validation
 * @param {function(ValueObjectFactory): Record<string, Function>} options.methodsFactory - Factory function that creates methods
 * @param {boolean | undefined} [options.overrideIsPrimitive] - Override primitive detection
 * @returns {ValueObjectFactory<z.infer<SchemaType>>} A factory function that creates value objects
 */
export function valueObject({
                              name,
                              schema,
                              methodsFactory,
                              overrideIsPrimitive = undefined,
                            }) {
  if (!name) throw new Error("Value object name is required");
  if (!schema) throw new Error("Value object schema is required");
  if (typeof methodsFactory !== 'function') throw new Error("Method factory is required");

  // Check if this is likely a primitive wrapper
  const isPrimitive =
      schema.constructor?.name === "ZodString" ||
      schema.constructor?.name === "ZodNumber" ||
      schema.constructor?.name === "ZodBoolean" ||
      overrideIsPrimitive;

  /**
   * Factory function to create value objects
   * @param {any} data - The data to create the value object from
   * @returns {ValueObject<z.infer<typeof schema>>} A new value object instance
   * @throws {ValidationError} If validation fails
   */
  function create(data) {
    try {
      // Parse and validate the data using the schema
      const validatedData = schema.parse(data);

      // Get primitive value for primitive types
      const primitiveValue = isPrimitive ? validatedData : undefined;

      // Create a complete prototype object with data and all methods (unbound)
      const prototype = {
        ...validatedData,

        /**
         * Returns the primitive value for primitive wrappers
         * @returns {any}
         */
        valueOf() {
          // If this is a primitive wrapper, return the primitive value
          if (isPrimitive) {
            return primitiveValue;
          }

          // For objects with a single primitive value property, return that
          const keys = Object.keys(validatedData);
          if (keys.length === 1 && typeof validatedData[keys[0]] !== "object") {
            return validatedData[keys[0]];
          }

          return this;
        },

        /**
         * Compares this value object with another for equality
         * Value objects are equal when all their properties are equal
         *
         * @param {any} other - The object to compare with
         * @returns {boolean} True if the objects are equal
         */
        equals(other) {
          if (other === null || other === undefined) {
            return false;
          }

          if (this === other) {
            return true;
          }

          // For primitive wrappers, compare primitive values
          if (isPrimitive) {
            return this.valueOf() === (other.valueOf ? other.valueOf() : other);
          }

          // Compare all properties
          const thisProps = Object.getOwnPropertyNames(this);
          const otherProps = Object.getOwnPropertyNames(other);

          // Create arrays of data properties (excluding methods)
          const thisDataProps = thisProps.filter(prop => typeof this[prop] !== "function");
          const otherDataProps = otherProps.filter(prop => typeof other[prop] !== "function");

          if (thisDataProps.length !== otherDataProps.length) {
            return false;
          }

          for (const prop of thisDataProps) {
            // eslint-disable-next-line no-prototype-builtins
            if (!other.hasOwnProperty(prop) || this[prop] !== other[prop]) {
              return false;
            }
          }

          return true;
        },

        /**
         * Returns a string representation of the value object
         * @returns {string}
         */
        toString() {
          // For primitive wrappers, just return the string representation of the primitive
          if (isPrimitive) {
            return String(primitiveValue);
          }

          return `${name}(${JSON.stringify(validatedData)})`;
        },
      };

      // Create a temporary factory for use in methodsFactory
      const tempFactory = {
        create,
        schema,
        extend
      };

      // Generate methods using the factory
      const methods = methodsFactory(tempFactory);

      // Now bind all methods to the complete prototype
      const boundMethods = {};
      for (const [methodName, methodFn] of Object.entries(methods)) {
        boundMethods[methodName] = methodFn.bind(prototype);
      }

      // Combine standard methods and bound custom methods, then freeze
      return Object.freeze({
        ...validatedData,
        valueOf: prototype.valueOf.bind(prototype),
        equals: prototype.equals.bind(prototype),
        toString: prototype.toString.bind(prototype),
        ...boundMethods,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
            `Invalid ${name}: ${error.errors.map((e) => e.message).join(", ")}`,
            error,
            { objectType: name, input: data },
        );
      }
      throw error;
    }
  }

  /**
   * Extends this value object with additional validation and methods
   *
   * @param {object} options - Extension options
   * @param {string} options.name - Name of the extended value object
   * @param {function} [options.schema] - Function to transform the base schema
   * @param {function} options.methodsFactory - Factory function to create methods for the extended object
   * @returns {ValueObjectFactory} A new factory for the extended value object
   */
  function extend({
                    name: extendedName,
                    schema: schemaTransformer,
                    methodsFactory: extendedMethodsFactory,
                  }) {
    if (!extendedName) {
      throw new Error("Extended value object name is required");
    }

    if (typeof extendedMethodsFactory !== 'function') {
      throw new Error("Method factory is required for extension");
    }

    // Create the new schema by transforming the original
    const extendedSchema = schemaTransformer
        ? schemaTransformer(schema)
        : schema;

    // Create a combined methods factory that includes the parent methods
    const combinedMethodsFactory = (factory) => {
      // First get the methods from the original factory
      const parentFactoryTemp = { create, schema, extend };
      const parentMethods = methodsFactory(parentFactoryTemp);
      
      // Then get the methods from the extended factory
      const extendedMethods = extendedMethodsFactory(factory);
      
      // Combine them, with extended methods taking precedence
      return {
        ...parentMethods,
        ...extendedMethods
      };
    };

    // Create a new value object factory with combined methods
    return valueObject({
      name: extendedName,
      schema: extendedSchema,
      methodsFactory: combinedMethodsFactory,
      overrideIsPrimitive,
    });
  }

  // Return the factory with create, schema, and extend methods
  return {
    create,
    schema,
    extend,
  };
}
