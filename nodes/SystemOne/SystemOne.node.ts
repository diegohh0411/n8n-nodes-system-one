import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, UserError } from 'n8n-workflow';

import {
	endpointProperties,
	optionProperties,
	outputProperties,
	questionProperties,
	stateProperties,
} from './description';
import {
	buildQuestions,
	buildStateFromFields,
	checkQuestionCount,
	type EndpointCredentials,
	type JsonValue,
	MAX_IMAGES_CLOUDFLARE,
	parseJson,
	type Provider,
	type QuestionUi,
	type Questions,
	resolveEndpoint,
	simplifyAnswers,
	uncertainAnswers,
	unwrapResponse,
	validateQuestionsMap,
} from './request';

const MODEL_PARAMETERS: Record<Provider, string> = {
	typeSafe: 'modelTypeSafe',
	openRouter: 'modelOpenRouter',
	cloudflare: 'modelCloudflare',
	custom: 'modelCustom',
};

const CREDENTIAL_TYPES: Record<Provider, string> = {
	typeSafe: 'typeSafeApi',
	openRouter: 'systemOneOpenRouterApi',
	cloudflare: 'systemOneCloudflareApi',
	custom: 'systemOneCustomApi',
};

interface NodeOptions {
	extraBody?: unknown;
	imageBinaryProperties?: string;
	includeInputFields?: boolean;
	includeRequest?: boolean;
	noulThreshold?: number;
	outputField?: string;
	timeout?: number;
}

export class SystemOne implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'System One',
		name: 'systemOne',
		icon: { light: 'file:systemOne.svg', dark: 'file:systemOne.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{ "Decide via " + {"openRouter":"OpenRouter","typeSafe":"TypeSafe","cloudflare":"Cloudflare","custom":"Custom Endpoint"}[$parameter["provider"]] }}',
		description:
			'Make fast, typed decisions (choice, score, yes/no) with System One models such as Jev and Clef',
		defaults: {
			name: 'System One',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: `={{ $parameter["confidenceRouting"] ? [{ type: "${NodeConnectionTypes.Main}", displayName: "Confident" }, { type: "${NodeConnectionTypes.Main}", displayName: "Uncertain" }] : ["${NodeConnectionTypes.Main}"] }}`,
		usableAsTool: true,
		credentials: [
			{
				name: 'systemOneOpenRouterApi',
				required: true,
				displayOptions: { show: { provider: ['openRouter'] } },
			},
			{
				name: 'typeSafeApi',
				required: true,
				displayOptions: { show: { provider: ['typeSafe'] } },
			},
			{
				name: 'systemOneCloudflareApi',
				required: true,
				displayOptions: { show: { provider: ['cloudflare'] } },
			},
			{
				name: 'systemOneCustomApi',
				required: true,
				displayOptions: { show: { provider: ['custom'] } },
			},
		],
		properties: [
			...endpointProperties,
			...stateProperties,
			...questionProperties,
			...outputProperties,
			...optionProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const confident: INodeExecutionData[] = [];
		const uncertain: INodeExecutionData[] = [];

		const provider = this.getNodeParameter('provider', 0) as Provider;
		const credentialType = CREDENTIAL_TYPES[provider];
		const credentials = (await this.getCredentials(credentialType)) as EndpointCredentials;
		const confidenceRouting = this.getNodeParameter('confidenceRouting', 0, false) as boolean;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const model = (this.getNodeParameter(MODEL_PARAMETERS[provider], itemIndex) as string).trim();
				const options = this.getNodeParameter('options', itemIndex, {}) as NodeOptions;

				const body: IDataObject = {
					model,
					state: getState(this, itemIndex, items[itemIndex]) as IDataObject,
					questions: getQuestions(this, itemIndex, provider) as unknown as IDataObject,
				};

				if (provider === 'cloudflare' && options.imageBinaryProperties) {
					body.images = await getImages(this, itemIndex, options.imageBinaryProperties);
				}
				if (options.extraBody !== undefined && options.extraBody !== '') {
					const extra = parseJson(options.extraBody, 'Extra Body Fields');
					if (typeof extra !== 'object' || extra === null || Array.isArray(extra)) {
						throw new UserError('Extra Body Fields must be a JSON object');
					}
					Object.assign(body, extra);
				}

				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: resolveEndpoint(provider, model, credentials),
					body,
					json: true,
					timeout: options.timeout ?? 30000,
				};

				let rawResponse: unknown;
				try {
					rawResponse = await this.helpers.httpRequestWithAuthentication.call(
						this,
						credentialType,
						requestOptions,
					);
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
				}

				const response = unwrapResponse(rawResponse);

				let result: IDataObject;
				const outputFormat = this.getNodeParameter('outputFormat', itemIndex) as string;
				if (outputFormat === 'raw') {
					result = rawResponse as IDataObject;
				} else if (outputFormat === 'answers') {
					result = {
						answers: response.answers as unknown as IDataObject,
						model: response.model,
						usage: response.usage,
					};
				} else {
					result = simplifyAnswers(response.answers, {
						noulThreshold: options.noulThreshold ?? 0.5,
					});
				}

				let isUncertain = false;
				if (confidenceRouting) {
					const threshold = this.getNodeParameter('confidenceThreshold', itemIndex, 0.7) as number;
					const uncertainIds = uncertainAnswers(response.answers, threshold);
					isUncertain = uncertainIds.length > 0;
					result._uncertain = uncertainIds;
				}
				if (options.includeRequest) result._request = body;

				const outputField = options.outputField ?? 'decision';
				const base = options.includeInputFields === false ? {} : { ...items[itemIndex].json };
				const json: IDataObject = outputField ? { ...base, [outputField]: result } : { ...base, ...result };

				const outItem: INodeExecutionData = {
					json,
					pairedItem: { item: itemIndex },
				};
				if (items[itemIndex].binary) outItem.binary = items[itemIndex].binary;
				(isUncertain ? uncertain : confident).push(outItem);
			} catch (error) {
				if (this.continueOnFail()) {
					confident.push({
						json: { ...items[itemIndex].json, error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				const nodeError =
					error instanceof NodeApiError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex });
				throw nodeError;
			}
		}

		return confidenceRouting ? [confident, uncertain] : [confident];
	}
}

function getState(ctx: IExecuteFunctions, itemIndex: number, item: INodeExecutionData): JsonValue {
	const source = ctx.getNodeParameter('stateSource', itemIndex) as string;
	switch (source) {
		case 'fields': {
			const fields = ctx.getNodeParameter('stateFields.field', itemIndex, []) as Array<{
				name?: string;
				value?: unknown;
			}>;
			if (fields.length === 0) throw new UserError('Add at least one state field');
			return buildStateFromFields(fields);
		}
		case 'text': {
			const text = ctx.getNodeParameter('stateText', itemIndex) as string;
			if (!text.trim()) throw new UserError('State is empty');
			return text;
		}
		case 'json':
			return parseJson(ctx.getNodeParameter('stateJson', itemIndex), 'State (JSON)');
		default:
			return item.json as JsonValue;
	}
}

function getQuestions(ctx: IExecuteFunctions, itemIndex: number, provider: Provider): Questions {
	const mode = ctx.getNodeParameter('questionsMode', itemIndex) as string;
	const questions =
		mode === 'json'
			? validateQuestionsMap(parseJson(ctx.getNodeParameter('questionsJson', itemIndex), 'Questions (JSON)'))
			: buildQuestions(ctx.getNodeParameter('questions.question', itemIndex, []) as QuestionUi[]);
	checkQuestionCount(questions, provider);
	return questions;
}

async function getImages(ctx: IExecuteFunctions, itemIndex: number, propertyList: string): Promise<string[]> {
	const names = propertyList
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);
	if (names.length > MAX_IMAGES_CLOUDFLARE) {
		throw new UserError(`Clef accepts at most ${MAX_IMAGES_CLOUDFLARE} images per request`);
	}
	const images: string[] = [];
	for (const name of names) {
		const binary = ctx.helpers.assertBinaryData(itemIndex, name);
		if (!['image/png', 'image/jpeg', 'image/webp'].includes(binary.mimeType)) {
			throw new UserError(`Binary field "${name}" is ${binary.mimeType}; Clef accepts PNG, JPEG, or WebP`);
		}
		const buffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, name);
		images.push(`data:${binary.mimeType};base64,${buffer.toString('base64')}`);
	}
	return images;
}
