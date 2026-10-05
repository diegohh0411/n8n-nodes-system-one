// Exercises SystemOne.execute() with a minimal fake n8n context.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { SystemOne } = require('../dist/nodes/SystemOne/SystemOne.node.js');

const RESPONSE = {
	model: 'jev-1.13.0',
	answers: {
		urgent: { type: 'noul', noul: 0.97 },
		team: { type: 'choice', choice: 'technical', probabilities: { billing: 0.4, technical: 0.6 }, confidence: 0.3 },
	},
	usage: { input_tokens: 10, output_tokens: 2 },
};

function makeContext({ params, items, credentials, response = RESPONSE, binary }) {
	const calls = [];
	const ctx = {
		getInputData: () => items,
		getNode: () => ({ name: 'System One', type: 'systemOne', typeVersion: 1, parameters: {} }),
		getCredentials: async (type) => {
			calls.push({ credentialType: type });
			return credentials;
		},
		continueOnFail: () => false,
		getNodeParameter(name, itemIndex, fallback) {
			const path = name.split('.');
			let value = typeof params === 'function' ? params(itemIndex) : params;
			for (const key of path) value = value?.[key];
			return value === undefined ? fallback : value;
		},
		helpers: {
			httpRequestWithAuthentication: async function (credentialType, options) {
				calls.push({ credentialType, options });
				return typeof response === 'function' ? response(options) : response;
			},
			assertBinaryData: (i, name) => binary[name],
			getBinaryDataBuffer: async (i, name) => Buffer.from(binary[name].raw),
		},
	};
	return { ctx, calls };
}

const baseParams = {
	provider: 'openRouter',
	modelOpenRouter: '~typesafe/jev-latest',
	stateSource: 'fields',
	stateFields: { field: [{ name: 'ticket', value: 'Checkout is down' }, { name: 'meta', value: { tier: 'pro' } }] },
	questionsMode: 'builder',
	questions: {
		question: [
			{ id: 'urgent', type: 'noul', instructions: 'Is `ticket` urgent?' },
			{
				id: 'team',
				type: 'choice',
				instructions: 'Which team?',
				choiceOptions: { option: [{ name: 'billing' }, { name: 'technical' }] },
			},
		],
	},
	outputFormat: 'simplified',
	confidenceRouting: false,
	options: {},
};

test('sends a System One request to OpenRouter and simplifies the output', async () => {
	const { ctx, calls } = makeContext({
		params: baseParams,
		items: [{ json: { id: 1 } }],
		credentials: { apiKey: 'k', baseUrl: 'https://openrouter.ai' },
	});
	const [out] = await new SystemOne().execute.call(ctx);
	const request = calls.find((c) => c.options).options;
	assert.equal(request.url, 'https://openrouter.ai/api/v1/systemone');
	assert.equal(calls[0].credentialType, 'systemOneOpenRouterApi');
	assert.deepEqual(request.body, {
		model: '~typesafe/jev-latest',
		state: { ticket: 'Checkout is down', meta: { tier: 'pro' } },
		questions: {
			urgent: { type: 'noul', instructions: 'Is `ticket` urgent?' },
			team: { type: 'choice', instructions: 'Which team?', criteria: { billing: null, technical: null } },
		},
	});
	assert.equal(out.length, 1);
	assert.equal(out[0].json.id, 1);
	assert.equal(out[0].json.decision.team, 'technical');
	assert.equal(out[0].json.decision.urgent_yes, true);
});

test('routes low-confidence items to the Uncertain output', async () => {
	const { ctx } = makeContext({
		params: { ...baseParams, confidenceRouting: true, confidenceThreshold: 0.5, options: {} },
		items: [{ json: {} }],
		credentials: { apiKey: 'k' },
	});
	const outputs = await new SystemOne().execute.call(ctx);
	assert.equal(outputs.length, 2);
	assert.equal(outputs[0].length, 0);
	assert.deepEqual(outputs[1][0].json.decision._uncertain, ['team']);
});

test('calls Cloudflare clef with images and unwraps the result envelope', async () => {
	const { ctx, calls } = makeContext({
		params: {
			...baseParams,
			provider: 'cloudflare',
			modelCloudflare: 'clef',
			stateSource: 'text',
			stateText: 'A photo of a receipt',
			outputFormat: 'answers',
			options: { imageBinaryProperties: 'data', includeInputFields: false, outputField: '' },
		},
		items: [{ json: { ignored: true } }],
		credentials: { accountId: 'acc', apiToken: 't' },
		binary: { data: { mimeType: 'image/png', raw: 'png' } },
		response: { result: RESPONSE, success: true },
	});
	const [out] = await new SystemOne().execute.call(ctx);
	const request = calls.find((c) => c.options).options;
	assert.equal(request.url, 'https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/cloudflare/clef');
	assert.deepEqual(request.body.images, ['data:image/png;base64,cG5n']);
	assert.deepEqual(Object.keys(out[0].json).sort(), ['answers', 'model', 'usage']);
});

test('sends the whole input item as state and merges extra body fields', async () => {
	const { ctx, calls } = makeContext({
		params: {
			...baseParams,
			provider: 'typeSafe',
			modelTypeSafe: 'jev-latest',
			stateSource: 'item',
			questionsMode: 'json',
			questionsJson: '{"urgent":{"type":"noul","instructions":"Urgent?"}}',
			outputFormat: 'raw',
			options: { extraBody: '{"trace":{"x":1}}' },
		},
		items: [{ json: { message: 'help' } }],
		credentials: { apiKey: 'k', baseUrl: 'https://api.typesafe.ai' },
	});
	const [out] = await new SystemOne().execute.call(ctx);
	const request = calls.find((c) => c.options).options;
	assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone');
	assert.deepEqual(request.body.state, { message: 'help' });
	assert.deepEqual(request.body.trace, { x: 1 });
	assert.deepEqual(out[0].json.decision, RESPONSE);
});

test('surfaces validation errors as node errors', async () => {
	const { ctx } = makeContext({
		params: { ...baseParams, questions: { question: [{ id: 'x', type: 'choice', instructions: 'q' }] } },
		items: [{ json: {} }],
		credentials: { apiKey: 'k' },
	});
	await assert.rejects(() => new SystemOne().execute.call(ctx), /between 2 and 255 options/);
});
