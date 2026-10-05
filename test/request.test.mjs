// Runs against the compiled output: `npm test` builds first.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const r = require('../dist/nodes/SystemOne/request.js');

test('builds noul, choice and score questions from the builder UI', () => {
	const questions = r.buildQuestions([
		{ id: 'is_urgent', type: 'noul', instructions: 'Urgent?', noulTrue: 'Time-sensitive', noulFalse: '' },
		{
			id: 'team',
			type: 'choice',
			instructions: 'Which team?',
			choiceOptions: { option: [{ name: 'billing', description: 'Payments' }, { name: 'technical' }] },
		},
		{
			id: 'frustration',
			type: 'score',
			instructions: 'How frustrated?',
			scoreLevels: { level: [{ description: 'Calm' }, { description: 'Angry' }] },
		},
	]);
	assert.deepEqual(questions, {
		is_urgent: { type: 'noul', instructions: 'Urgent?', criteria: { true: 'Time-sensitive' } },
		team: { type: 'choice', instructions: 'Which team?', criteria: { billing: 'Payments', technical: null } },
		frustration: { type: 'score', instructions: 'How frustrated?', criteria: ['Calm', 'Angry'] },
	});
});

test('omits noul criteria when neither side is described', () => {
	const [, q] = r.buildQuestion({ id: 'a', type: 'noul', instructions: 'x' }, 0);
	assert.equal('criteria' in q, false);
});

test('accepts JSON instructions, options and levels', () => {
	const questions = r.buildQuestions([
		{
			id: 'dup',
			type: 'choice',
			instructionsMode: 'json',
			instructionsJson: '{"ref":{"name":"A"},"question":"Same as `ref`?"}',
			choiceMode: 'json',
			choiceJson: { yes: null, no: { detail: 'different' } },
		},
		{ id: 's', type: 'score', instructions: 'x', scoreMode: 'json', scoreJson: '["lo","hi"]' },
	]);
	assert.deepEqual(questions.dup.instructions, { ref: { name: 'A' }, question: 'Same as `ref`?' });
	assert.deepEqual(questions.dup.criteria, { yes: null, no: { detail: 'different' } });
	assert.deepEqual(questions.s.criteria, ['lo', 'hi']);
});

test('rejects invalid questions with helpful messages', () => {
	assert.throws(() => r.buildQuestions([{ id: 'bad id', type: 'noul', instructions: 'x' }]), /ID must be/);
	assert.throws(() => r.buildQuestions([{ id: 'a', type: 'noul', instructions: ' ' }]), /instructions are required/);
	assert.throws(
		() => r.buildQuestions([{ id: 'a', type: 'choice', instructions: 'x', choiceOptions: { option: [{ name: 'one' }] } }]),
		/between 2 and 255 options/,
	);
	assert.throws(
		() => r.buildQuestions([{ id: 'a', type: 'score', instructions: 'x', scoreLevels: { level: [{ description: 'only' }] } }]),
		/between 2 and 10 levels/,
	);
	assert.throws(
		() =>
			r.buildQuestions([
				{ id: 'a', type: 'noul', instructions: 'x' },
				{ id: 'a', type: 'noul', instructions: 'y' },
			]),
		/Duplicate question ID/,
	);
	assert.throws(() => r.parseJson('{nope', 'State'), /State is not valid JSON/);
});

test('validates a raw questions map and Cloudflare question limit', () => {
	assert.throws(() => r.validateQuestionsMap([]), /must be an object/);
	assert.throws(() => r.validateQuestionsMap({ a: { type: 'maybe', instructions: 'x' } }), /type "noul"/);
	const many = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`q${i}`, { type: 'noul', instructions: 'x' }]));
	assert.throws(() => r.checkQuestionCount(many, 'cloudflare'), /at most 64/);
	assert.doesNotThrow(() => r.checkQuestionCount(many, 'typeSafe'));
	assert.throws(() => r.checkQuestionCount({}, 'typeSafe'), /at least one question/);
});

test('resolves endpoints per provider', () => {
	assert.equal(r.resolveEndpoint('typeSafe', 'jev-latest', { baseUrl: 'https://api.typesafe.ai/' }), 'https://api.typesafe.ai/v1/systemone');
	assert.equal(r.resolveEndpoint('openRouter', 'x', { baseUrl: 'https://openrouter.ai' }), 'https://openrouter.ai/api/v1/systemone');
	assert.equal(
		r.resolveEndpoint('cloudflare', 'clef-flash', { accountId: 'abc' }),
		'https://api.cloudflare.com/client/v4/accounts/abc/ai/run/@cf/cloudflare/clef-flash',
	);
	assert.equal(r.resolveEndpoint('custom', 'm', { url: ' https://x.test/v1/systemone ' }), 'https://x.test/v1/systemone');
	assert.throws(() => r.resolveEndpoint('cloudflare', 'clef', {}), /Account ID/);
});

const answers = {
	is_urgent: { type: 'noul', noul: 0.95 },
	team: { type: 'choice', choice: 'billing', probabilities: { billing: 0.88, technical: 0.12 }, confidence: 0.81 },
	frustration: {
		type: 'score',
		score: 1.05,
		legend: { 0: 'Calm', 1: 'Frustrated', 2: 'Very angry' },
		probabilities: { 0: 0, 1: 0.95, 2: 0.05 },
		confidence: 0.6,
	},
};

test('unwraps Cloudflare result envelopes and rejects bodies without answers', () => {
	const body = { model: 'clef', answers, usage: {} };
	assert.deepEqual(r.unwrapResponse({ result: body, success: true, errors: [] }), body);
	assert.deepEqual(r.unwrapResponse(JSON.stringify(body)), body);
	assert.throws(() => r.unwrapResponse({ error: 'x' }), /does not contain "answers"/);
});

test('simplifies answers into flat fields', () => {
	assert.deepEqual(r.simplifyAnswers(answers, { noulThreshold: 0.5 }), {
		is_urgent: 0.95,
		is_urgent_yes: true,
		team: 'billing',
		team_confidence: 0.81,
		team_probabilities: { billing: 0.88, technical: 0.12 },
		frustration: 1.05,
		frustration_level: 'Frustrated',
		frustration_confidence: 0.6,
		frustration_probabilities: { 0: 0, 1: 0.95, 2: 0.05 },
	});
});

test('flags uncertain answers against a threshold', () => {
	assert.deepEqual(r.uncertainAnswers(answers, 0.7), ['frustration']);
	assert.deepEqual(r.uncertainAnswers({ n: { type: 'noul', noul: 0.6 } }, 0.7), ['n']);
	assert.deepEqual(r.uncertainAnswers({ n: { type: 'noul', noul: 0.1 } }, 0.7), []);
});
