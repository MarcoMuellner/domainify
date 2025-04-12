import {Number} from "./Number.js";

/**
 * Creates an IntegerNumber value object that ensures values are integers
 * @returns {import('../Base.js').ValueObjectFactory<number>} Factory for integer numbers
 */
export const IntegerNumber = Number.extend({
    name: 'IntegerNumber',
    schema: (baseSchema) => baseSchema.int(),
    methods: {}
});
