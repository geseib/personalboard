// Persistence and model calls are injected so activation can be tested without AWS.
function createAiAdmin(store) {
    async function settings() {
        const registry = await store.invoke({internalAction: 'modelRegistry'});
        const current = await store.get();
        return {...registry, settings: current || {...registry.defaults, revision: 0}};
    }
    async function activate(input) {
        const {settings: previous} = await settings();
        if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== previous.revision) {
            throw Object.assign(new Error('Settings changed. Reload before activating your selection.'), {statusCode: 409});
        }
        const validated = await store.invoke({internalAction: 'validateSettings', settings: {
            defaultModel: input.defaultModel, overrides: input.overrides || {}, fallbackModel: input.fallbackModel || null
        }});
        if (validated.error) throw Object.assign(new Error(validated.error), {statusCode: 400});
        const next = {...validated.settings, revision: previous.revision + 1, updatedAt: new Date().toISOString()};
        try { await store.save(next, previous, input.expectedRevision); }
        catch (error) {
            if (error.name === 'TransactionCanceledException' || error.name === 'ConditionalCheckFailedException') {
                throw Object.assign(new Error('Settings changed. Reload before activating your selection.'), {statusCode: 409});
            }
            throw error;
        }
        return next;
    }
    return {
        settings, activate, history: () => store.history(),
        async rollback(input) {
            if (!Number.isInteger(input.revision) || input.revision < 0) throw Object.assign(new Error('Invalid revision'), {statusCode: 400});
            const previous = await store.revision(input.revision);
            if (!previous) throw Object.assign(new Error('Revision not found'), {statusCode: 404});
            return activate({...previous, expectedRevision: input.expectedRevision});
        },
        async compare(input) {
            if (!Array.isArray(input.modelIds) || input.modelIds.length < 1 || input.modelIds.length > 2 ||
                new Set(input.modelIds).size !== input.modelIds.length || typeof input.prompt !== 'string' ||
                !input.prompt.trim() || input.prompt.length > 12000 || !['writing','board'].includes(input.task)) {
                throw Object.assign(new Error('Choose one or two different models and enter a prompt (up to 12,000 characters).'), {statusCode: 400});
            }
            const result = await store.invoke({internalAction:'compareModels', modelIds:input.modelIds, prompt:input.prompt, task:input.task});
            if (result.error) throw Object.assign(new Error(result.error), {statusCode:400});
            return result;
        }
    };
}
module.exports = {createAiAdmin};
