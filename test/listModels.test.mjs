import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const m = require('../dist/nodes/SystemOne/listModels.js');

test('parses OpenAI-style model lists and filters OpenRouter to TypeSafe models', () => {
	const response = { data: [{ id: 'openai/gpt-5' }, { id: 'typesafe/jev-1.13', name: 'Jev 1.13' }, { id: '~typesafe/jev-latest' }] };
	assert.deepEqual(m.parseModelList(response, m.isSystemOneOpenRouterModel).map((o) => o.value), ['~typesafe/jev-latest', 'typesafe/jev-1.13']);
	assert.deepEqual(m.parseModelList({}), []);
});

test('parses Workers AI search results, keeping Clef models', () => {
	const response = { result: [{ name: '@cf/cloudflare/clef-flash' }, { name: '@cf/meta/llama' }, { name: '@cf/cloudflare/clef' }] };
	assert.deepEqual(m.parseCloudflareModels(response).map((o) => o.value), ['@cf/cloudflare/clef', '@cf/cloudflare/clef-flash']);
});

test('fetches TypeSafe models through the credential base URL', async () => {
	let request;
	const ctx = {
		getCredentials: async () => ({ baseUrl: 'https://api.example.com/' }),
		helpers: { httpRequestWithAuthentication: async (type, options) => ((request = { type, options }), { data: [{ id: 'jev-latest' }] }) },
	};
	const options = await m.getTypeSafeModels.call(ctx);
	assert.equal(request.type, 'typeSafeApi');
	assert.equal(request.options.url, 'https://api.example.com/v1/models');
	assert.deepEqual(options.map((o) => o.value), ['jev-latest']);
});
