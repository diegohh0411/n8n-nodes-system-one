import type { IDataObject } from 'n8n-workflow';
import { UserError } from 'n8n-workflow';

export type Provider = 'typeSafe' | 'openRouter' | 'cloudflare' | 'custom';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type QuestionType = 'noul' | 'choice' | 'score';

/** A single question as it is sent to a System One endpoint. */
export interface Question {
	type: QuestionType;
	instructions: JsonValue;
	criteria?: JsonValue;
}

export type Questions = Record<string, Question>;

/** A question as configured in the node's question builder UI. */
export interface QuestionUi {
	id?: string;
	type?: QuestionType;
	instructionsMode?: 'text' | 'json';
	instructions?: string;
	instructionsJson?: unknown;
	noulTrue?: string;
	noulFalse?: string;
	choiceMode?: 'list' | 'json';
	choiceOptions?: { option?: Array<{ name?: string; description?: string }> };
	choiceJson?: unknown;
	scoreMode?: 'list' | 'json';
	scoreLevels?: { level?: Array<{ description?: string }> };
	scoreJson?: unknown;
}

export interface NoulAnswer {
	type: 'noul';
	noul: number;
}

export interface ChoiceAnswer {
	type: 'choice';
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}

export interface ScoreAnswer {
	type: 'score';
	score: number;
	legend: Record<string, string>;
	probabilities: Record<string, number>;
	confidence: number;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface SystemOneResponse {
	model?: string;
	answers: Record<string, Answer>;
	usage?: IDataObject;
	[key: string]: unknown;
}

export const QUESTION_ID_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
export const MAX_CHOICE_OPTIONS = 255;
export const MIN_SCORE_LEVELS = 2;
export const MAX_SCORE_LEVELS = 10;
export const MAX_QUESTIONS_CLOUDFLARE = 64;
export const MAX_IMAGES_CLOUDFLARE = 4;



/** Parses a JSON parameter that may arrive as a string or as an already-resolved value. */
export function parseJson(value: unknown, label: string): JsonValue {
	if (typeof value !== 'string') return value as JsonValue;
	const trimmed = value.trim();
	if (trimmed === '') throw new UserError(`${label} is empty`);
	const parsed = tryParseJson(trimmed);
	if (parsed === undefined) throw new UserError(`${label} is not valid JSON`);
	return parsed;
}

function tryParseJson(text: string): JsonValue | undefined {
	try {
		return JSON.parse(text) as JsonValue;
	} catch {
		return undefined;
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

export function buildQuestion(ui: QuestionUi, position: number): [string, Question] {
	const id = (ui.id ?? '').trim();
	const where = id ? `Question "${id}"` : `Question #${position + 1}`;

	if (!QUESTION_ID_PATTERN.test(id)) {
		throw new UserError(
			`${where}: ID must be 1-100 characters using only letters, digits, "_", "." or "-"`,
		);
	}

	const type = ui.type ?? 'noul';

	let instructions: JsonValue;
	if (ui.instructionsMode === 'json') {
		instructions = parseJson(ui.instructionsJson, `${where} instructions`);
	} else {
		if (isEmpty(ui.instructions)) throw new UserError(`${where}: instructions are required`);
		instructions = ui.instructions as string;
	}

	const question: Question = { type, instructions };

	if (type === 'noul') {
		const criteria: Record<string, string> = {};
		if (!isEmpty(ui.noulTrue)) criteria.true = ui.noulTrue as string;
		if (!isEmpty(ui.noulFalse)) criteria.false = ui.noulFalse as string;
		if (Object.keys(criteria).length > 0) question.criteria = criteria;
	} else if (type === 'choice') {
		let criteria: Record<string, JsonValue>;
		if (ui.choiceMode === 'json') {
			const parsed = parseJson(ui.choiceJson, `${where} options`);
			if (!isPlainObject(parsed)) {
				throw new UserError(`${where}: options JSON must be an object mapping option to description`);
			}
			criteria = parsed as Record<string, JsonValue>;
		} else {
			criteria = {};
			for (const option of ui.choiceOptions?.option ?? []) {
				const name = (option.name ?? '').trim();
				if (!name) throw new UserError(`${where}: every option needs a name`);
				if (name in criteria) throw new UserError(`${where}: duplicate option "${name}"`);
				criteria[name] = isEmpty(option.description) ? null : (option.description as string);
			}
		}
		const count = Object.keys(criteria).length;
		if (count < 2 || count > MAX_CHOICE_OPTIONS) {
			throw new UserError(`${where}: a choice needs between 2 and ${MAX_CHOICE_OPTIONS} options (got ${count})`);
		}
		question.criteria = criteria;
	} else if (type === 'score') {
		let criteria: JsonValue[];
		if (ui.scoreMode === 'json') {
			const parsed = parseJson(ui.scoreJson, `${where} levels`);
			if (!Array.isArray(parsed)) {
				throw new UserError(`${where}: levels JSON must be an array, lowest level first`);
			}
			criteria = parsed;
		} else {
			criteria = (ui.scoreLevels?.level ?? []).map((level, index) => {
				if (isEmpty(level.description)) {
					throw new UserError(`${where}: level ${index} needs a description`);
				}
				return level.description as string;
			});
		}
		if (criteria.length < MIN_SCORE_LEVELS || criteria.length > MAX_SCORE_LEVELS) {
			throw new UserError(
				`${where}: a score needs between ${MIN_SCORE_LEVELS} and ${MAX_SCORE_LEVELS} levels (got ${criteria.length})`,
			);
		}
		question.criteria = criteria;
	} else {
		throw new UserError(`${where}: unknown question type "${String(type)}"`);
	}

	return [id, question];
}

export function buildQuestions(uis: QuestionUi[]): Questions {
	const questions: Questions = {};
	uis.forEach((ui, index) => {
		const [id, question] = buildQuestion(ui, index);
		if (id in questions) throw new UserError(`Duplicate question ID "${id}"`);
		questions[id] = question;
	});
	return questions;
}

/** Validates a questions map supplied as raw JSON. */
export function validateQuestionsMap(value: JsonValue): Questions {
	if (!isPlainObject(value)) {
		throw new UserError('Questions JSON must be an object mapping question ID to question');
	}
	for (const [id, question] of Object.entries(value)) {
		if (!QUESTION_ID_PATTERN.test(id)) {
			throw new UserError(`Question ID "${id}" must use only letters, digits, "_", "." or "-"`);
		}
		if (!isPlainObject(question) || !['noul', 'choice', 'score'].includes(question.type as string)) {
			throw new UserError(`Question "${id}" must be an object with type "noul", "choice" or "score"`);
		}
		if (isEmpty(question.instructions)) {
			throw new UserError(`Question "${id}" is missing instructions`);
		}
	}
	return value as unknown as Questions;
}

export function checkQuestionCount(questions: Questions, provider: Provider): void {
	const count = Object.keys(questions).length;
	if (count === 0) throw new UserError('Add at least one question');
	if (provider === 'cloudflare' && count > MAX_QUESTIONS_CLOUDFLARE) {
		throw new UserError(`Cloudflare accepts at most ${MAX_QUESTIONS_CLOUDFLARE} questions per request (got ${count})`);
	}
}

export function buildStateFromFields(fields: Array<{ name?: string; value?: unknown }>): Record<string, JsonValue> {
	const state: Record<string, JsonValue> = {};
	for (const field of fields) {
		const name = (field.name ?? '').trim();
		if (!name) throw new UserError('Every state field needs a name');
		state[name] = (field.value ?? '') as JsonValue;
	}
	return state;
}

export interface EndpointCredentials {
	baseUrl?: string;
	accountId?: string;
	url?: string;
}

function trimSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

export function resolveEndpoint(
	provider: Provider,
	model: string,
	credentials: EndpointCredentials,
): string {
	switch (provider) {
		case 'typeSafe':
			return `${trimSlash(credentials.baseUrl || 'https://api.typesafe.ai')}/v1/systemone`;
		case 'openRouter':
			return `${trimSlash(credentials.baseUrl || 'https://openrouter.ai')}/api/v1/systemone`;
		case 'cloudflare': {
			if (!credentials.accountId) throw new UserError('The Cloudflare credential is missing the Account ID');
			// Bare slugs (e.g. "clef") from older workflows map to the @cf/cloudflare namespace.
			const name = model.trim().startsWith('@') ? model.trim() : `@cf/cloudflare/${model.trim()}`;
			return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId.trim())}/ai/run/${name}`;
		}
		case 'custom':
			if (!credentials.url) throw new UserError('The custom endpoint credential is missing the Endpoint URL');
			return credentials.url.trim();
	}
}

/** Workers AI REST responses wrap the model output in `{ result, success, errors, messages }`. */
export function unwrapResponse(response: unknown): SystemOneResponse {
	let body = response;
	if (typeof body === 'string') {
		body = tryParseJson(body);
		if (body === undefined) throw new UserError('The endpoint returned a non-JSON response');
	}
	if (isPlainObject(body) && !('answers' in body) && isPlainObject(body.result)) {
		body = body.result;
	}
	if (!isPlainObject(body) || !isPlainObject(body.answers)) {
		throw new UserError('The endpoint response does not contain "answers"');
	}
	return body as SystemOneResponse;
}

/**
 * How sure an answer is, on a 0-1 scale. Choice and score answers report confidence directly;
 * a noul is as sure as its distance from a coin flip, i.e. max(p, 1 - p) rescaled to 0-1.
 */
export function answerCertainty(answer: Answer): number {
	if (answer.type === 'noul') return Math.abs(answer.noul - 0.5) * 2;
	return answer.confidence;
}

export interface SimplifyOptions {
	noulThreshold: number;
}

/** Flattens answers into `{ id: value, id_confidence, ... }` for easy use in IF / Switch nodes. */
export function simplifyAnswers(answers: Record<string, Answer>, options: SimplifyOptions): IDataObject {
	const out: IDataObject = {};
	for (const [id, answer] of Object.entries(answers)) {
		if (answer.type === 'noul') {
			out[id] = answer.noul;
			out[`${id}_yes`] = answer.noul >= options.noulThreshold;
		} else if (answer.type === 'choice') {
			out[id] = answer.choice;
			out[`${id}_confidence`] = answer.confidence;
			out[`${id}_probabilities`] = answer.probabilities;
		} else if (answer.type === 'score') {
			out[id] = answer.score;
			out[`${id}_level`] = answer.legend?.[String(Math.round(answer.score))] ?? null;
			out[`${id}_confidence`] = answer.confidence;
			out[`${id}_probabilities`] = answer.probabilities;
		}
	}
	return out;
}

/** Returns the IDs of answers whose certainty is below the threshold. */
export function uncertainAnswers(answers: Record<string, Answer>, threshold: number): string[] {
	return Object.entries(answers)
		.filter(([, answer]) => answerCertainty(answer) < threshold)
		.map(([id]) => id);
}
