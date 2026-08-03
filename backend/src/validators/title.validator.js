import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

const exampleSchema = {
    type: 'object',
    properties: {
        order: { type: 'number' },
        example: { type: 'string', minLength: 1 },
        author: { type: 'string' }
    },
    required: ['example'],
    additionalProperties: false
};

const idiomSchema = {
    type: 'object',
    properties: {
        phrase: { type: 'string', minLength: 1, maxLength: 255 },
        description: { type: ['string', 'null'] },
        order: { type: 'number' }
    },
    required: ['phrase'],
    additionalProperties: false
};

const descriptionSchema = {
    type: 'object',
    properties: {
        category: { type: 'string', minLength: 1 },
        definition: { type: 'string', minLength: 1 },
        order: { type: 'number' },
        example: {
            type: 'array',
            items: exampleSchema,
            default: []
        },
        idioms: {
            type: 'array',
            items: idiomSchema,
            default: []
        }
    },
    required: ['category', 'definition'],
    additionalProperties: false
};

const etymologySchema = {
    type: 'object',
    properties: {
        description: { type: 'string', minLength: 1 },
        etymology_type: {
            type: 'string',
            enum: ['native', 'borrowed', 'derivative', 'compound', 'unknown']
        },
        original_language: { type: 'string' },
        root_word: { type: 'string' }
    },
    required: ['description'],
    additionalProperties: false
};

const titleItemSchema = {
    type: 'object',
    properties: {
        temp_id: { type: ['number', 'string'] },
        soz: { type: 'string', minLength: 1 },
        normalized: { type: 'string', minLength: 1 },
        descriptions: {
            type: 'array',
            items: descriptionSchema,
            minItems: 1
        },
        etymology: etymologySchema
    },
    required: ['soz', 'normalized', 'descriptions'],
    additionalProperties: false
};

const titlesArraySchema = {
    type: 'array',
    items: titleItemSchema,
    minItems: 1
};

const validateTitlesArray = ajv.compile(titlesArraySchema);

export { validateTitlesArray };
