import { z } from 'zod';

/**
 * Creates a Zod schema for validating value objects
 *
 * @template VOType - The value object type
 * @param {Object} [options] - Options for the schema
 * @param {string} [options.typeName] - Name of the expected value object type
 * @param {Function} [options.typeCheck] - Custom function to validate the type
 * @returns {z.ZodType<VOType>} A Zod schema that validates value objects
 */
export function valueObjectSchema(options = {}) {
    const { typeName = 'ValueObject', typeCheck } = options;

    return z.custom((val) => {
        // Basic check - must be an object with equals method
        const isValueObject = val instanceof Object && typeof val.equals === 'function';

        // If a custom type check is provided, use it for additional validation
        if (isValueObject && typeCheck) {
            return typeCheck(val);
        }

        return isValueObject;
    }, {
        message: `Expected a ${typeName}`
    });
}

/**
 * Creates a Zod schema for validating specific value object types
 *
 * @template VOFactory - The value object factory
 * @param {VOFactory} valueObjectFactory - The value object factory
 * @returns {z.ZodType} A Zod schema that validates instances of this value object
 * @throws {Error} If an invalid value object factory is provided
 */
export function specificValueObjectSchema(valueObjectFactory) {
    // Stricter validation to ensure we have a proper factory
    if (!valueObjectFactory) {
        throw new Error('Invalid value object factory provided');
    }

    if (typeof valueObjectFactory !== 'object') {
        throw new Error('Invalid value object factory provided');
    }

    if (typeof valueObjectFactory.create !== 'function') {
        throw new Error('Invalid value object factory provided');
    }

    const typeName = valueObjectFactory.name || 'ValueObject';

    return valueObjectSchema({
        typeName,
        // Check if the value is from this specific factory
        typeCheck: (val) => {
            try {
                // If we can recreate an equal value object with the same factory,
                // it's likely an instance of this type
                const testRecreate = valueObjectFactory.create(val.valueOf());
                return testRecreate.equals(val);
            } catch (e) {
                return false;
            }
        }
    });
}
