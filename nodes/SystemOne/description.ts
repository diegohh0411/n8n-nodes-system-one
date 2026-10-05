import type { INodeProperties } from 'n8n-workflow';

const showFor = (provider: string[]) => ({ show: { provider } });

export const endpointProperties: INodeProperties[] = [
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'OpenRouter',
				value: 'openRouter',
				description: 'Jev via OpenRouter, billed to your OpenRouter account',
			},
			{
				name: 'TypeSafe',
				value: 'typeSafe',
				description: 'Jev directly from TypeSafe (api.typesafe.ai/v1/systemone)',
			},
			{
				name: 'Cloudflare Workers AI',
				value: 'cloudflare',
				description: 'Clef or Clef Flash on Workers AI (supports images)',
			},
			{
				name: 'Custom Endpoint',
				value: 'custom',
				description: 'Any System One compatible endpoint',
			},
		],
		default: 'openRouter',
		description: 'Where to send the System One request',
	},
	{
		displayName: 'Endpoint',
		name: 'openRouterSurface',
		type: 'options',
		noDataExpression: true,
		displayOptions: showFor(['openRouter']),
		options: [
			{
				name: 'Decisions API',
				value: 'decisions',
				description: 'POST /api/alpha/decisions',
			},
			{
				name: 'System One API',
				value: 'systemOne',
				description: 'POST /api/v1/systemone (TypeSafe-compatible)',
			},
		],
		default: 'decisions',
	},
	{
		displayName: 'Model',
		name: 'modelOpenRouter',
		type: 'options',
		displayOptions: showFor(['openRouter']),
		options: [
			{ name: 'Jev (Latest)', value: '~typesafe/jev-latest' },
			{ name: 'Jev 1.13', value: 'typesafe/jev-1.13' },
		],
		default: '~typesafe/jev-latest',
		description: 'Model to evaluate with. Use an expression to send any other model ID.',
	},
	{
		displayName: 'Model',
		name: 'modelTypeSafe',
		type: 'options',
		displayOptions: showFor(['typeSafe']),
		options: [
			{ name: 'Jev (Latest)', value: 'jev-latest', description: 'Most recent stable release' },
			{ name: 'Jev (Preview)', value: 'jev-preview', description: 'Most recent release, stable or not' },
			{ name: 'Jev 1.13.0', value: 'jev-1.13.0', description: 'Pinned version' },
		],
		default: 'jev-latest',
		description:
			'Model to evaluate with. Pin a version if you tuned confidence thresholds against it. Use an expression to send any other model ID.',
	},
	{
		displayName: 'Model',
		name: 'modelCloudflare',
		type: 'options',
		displayOptions: showFor(['cloudflare']),
		options: [
			{ name: 'Clef', value: 'clef', description: '@cf/cloudflare/clef' },
			{ name: 'Clef Flash', value: 'clef-flash', description: '@cf/cloudflare/clef-flash' },
		],
		default: 'clef',
	},
	{
		displayName: 'Model',
		name: 'modelCustom',
		type: 'string',
		displayOptions: showFor(['custom']),
		default: 'jev-latest',
		required: true,
	},
];

export const stateProperties: INodeProperties[] = [
	{
		displayName: 'State Source',
		name: 'stateSource',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Whole Input Item',
				value: 'item',
				description: "Send the incoming item's JSON as the state",
			},
			{
				name: 'Define Fields',
				value: 'fields',
				description: 'Build a state object field by field',
			},
			{
				name: 'Text',
				value: 'text',
				description: 'Send a plain string as the state',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'Send a JSON object or array as the state',
			},
		],
		default: 'item',
		description:
			'The content System One evaluates. Structured state works best: name fields clearly and refer to them in questions using `backticks`.',
	},
	{
		displayName: 'State Fields',
		name: 'stateFields',
		type: 'fixedCollection',
		placeholder: 'Add Field',
		typeOptions: { multipleValues: true },
		displayOptions: { show: { stateSource: ['fields'] } },
		default: {},
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: 'e.g. ticket',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						placeholder: 'e.g. {{ $json.body }}',
						description: 'Expressions that return objects or arrays are kept as structured data',
					},
				],
			},
		],
	},
	{
		displayName: 'State',
		name: 'stateText',
		type: 'string',
		typeOptions: { rows: 4 },
		displayOptions: { show: { stateSource: ['text'] } },
		default: '',
		placeholder: 'e.g. Help! My payouts have been failing for 3 days.',
	},
	{
		displayName: 'State (JSON)',
		name: 'stateJson',
		type: 'json',
		displayOptions: { show: { stateSource: ['json'] } },
		default: '{\n  "ticket": "",\n  "customer_tier": ""\n}',
	},
];

const questionValues: INodeProperties[] = [
	{
		displayName: 'ID',
		name: 'id',
		type: 'string',
		default: '',
		placeholder: 'e.g. is_urgent',
		description:
			'Key the answer is returned under. Letters, digits, "_", "." and "-" only. Not sent to the model.',
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: [
			{
				name: 'Noul (Yes/No)',
				value: 'noul',
				description: 'Returns the probability that the answer is yes',
			},
			{
				name: 'Choice',
				value: 'choice',
				description: 'Picks one option from a set, with a probability per option and confidence',
			},
			{
				name: 'Score',
				value: 'score',
				description: 'Rates against ordered levels, with a probability per level and confidence',
			},
		],
		default: 'noul',
	},
	{
		displayName: 'Instructions Format',
		name: 'instructionsMode',
		type: 'options',
		options: [
			{ name: 'Text', value: 'text' },
			{
				name: 'JSON',
				value: 'json',
				description: 'Structured instructions: the question in one field, referenced data in others',
			},
		],
		default: 'text',
	},
	{
		displayName: 'Instructions',
		name: 'instructions',
		type: 'string',
		typeOptions: { rows: 2 },
		displayOptions: { show: { instructionsMode: ['text'] } },
		default: '',
		placeholder: 'e.g. Does this convey urgency?',
		description: 'The question to evaluate. Refer to state fields by name in `backticks`.',
	},
	{
		displayName: 'Instructions (JSON)',
		name: 'instructionsJson',
		type: 'json',
		displayOptions: { show: { instructionsMode: ['json'] } },
		default: '{\n  "reference": {},\n  "question": "Does the state match `reference`?"\n}',
	},
	{
		displayName: 'Yes Means',
		name: 'noulTrue',
		type: 'string',
		displayOptions: { show: { type: ['noul'] } },
		default: '',
		placeholder: 'e.g. Explicitly time-sensitive',
		description: 'Optional: what a yes (value near 1) means',
	},
	{
		displayName: 'No Means',
		name: 'noulFalse',
		type: 'string',
		displayOptions: { show: { type: ['noul'] } },
		default: '',
		placeholder: 'e.g. No urgency expressed',
		description: 'Optional: what a no (value near 0) means',
	},
	{
		displayName: 'Define Options',
		name: 'choiceMode',
		type: 'options',
		displayOptions: { show: { type: ['choice'] } },
		options: [
			{ name: 'Using List', value: 'list' },
			{ name: 'Using JSON', value: 'json' },
		],
		default: 'list',
	},
	{
		displayName: 'Options',
		name: 'choiceOptions',
		type: 'fixedCollection',
		placeholder: 'Add Option',
		typeOptions: { multipleValues: true, sortable: true },
		displayOptions: { show: { type: ['choice'], choiceMode: ['list'] } },
		default: {},
		description: '2 to 255 options',
		options: [
			{
				displayName: 'Option',
				name: 'option',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						placeholder: 'e.g. billing',
						description: 'Value returned when this option is chosen',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						placeholder: 'e.g. Payments, invoicing, refunds',
						description: 'Optional rubric describing when this option applies',
					},
				],
			},
		],
	},
	{
		displayName: 'Options (JSON)',
		name: 'choiceJson',
		type: 'json',
		displayOptions: { show: { type: ['choice'], choiceMode: ['json'] } },
		default: '{\n  "billing": "Payments, invoicing, refunds",\n  "technical": "Bugs, outages, integrations"\n}',
		description: 'Object mapping each option to its description (string, object, array, or null)',
	},
	{
		displayName: 'Define Levels',
		name: 'scoreMode',
		type: 'options',
		displayOptions: { show: { type: ['score'] } },
		options: [
			{ name: 'Using List', value: 'list' },
			{ name: 'Using JSON', value: 'json' },
		],
		default: 'list',
	},
	{
		displayName: 'Levels',
		name: 'scoreLevels',
		type: 'fixedCollection',
		placeholder: 'Add Level',
		typeOptions: { multipleValues: true, sortable: true },
		displayOptions: { show: { type: ['score'], scoreMode: ['list'] } },
		default: {},
		description: '2 to 10 ordered levels, lowest first. The first level is 0.',
		options: [
			{
				displayName: 'Level',
				name: 'level',
				values: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						placeholder: 'e.g. Calm',
					},
				],
			},
		],
	},
	{
		displayName: 'Levels (JSON)',
		name: 'scoreJson',
		type: 'json',
		displayOptions: { show: { type: ['score'], scoreMode: ['json'] } },
		default: '["Calm", "Frustrated", "Very angry"]',
		description: 'Array of level descriptions, lowest first',
	},
];

export const questionProperties: INodeProperties[] = [
	{
		displayName: 'Define Questions',
		name: 'questionsMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Builder', value: 'builder' },
			{
				name: 'Using JSON',
				value: 'json',
				description: 'Paste or compute a full questions map',
			},
		],
		default: 'builder',
	},
	{
		displayName: 'Questions',
		name: 'questions',
		type: 'fixedCollection',
		placeholder: 'Add Question',
		typeOptions: { multipleValues: true, sortable: true },
		displayOptions: { show: { questionsMode: ['builder'] } },
		default: {},
		description:
			'All questions are evaluated in parallel against the same state. Asking several at once is cheap.',
		options: [{ displayName: 'Question', name: 'question', values: questionValues }],
	},
	{
		displayName: 'Questions (JSON)',
		name: 'questionsJson',
		type: 'json',
		displayOptions: { show: { questionsMode: ['json'] } },
		default:
			'{\n  "is_urgent": {\n    "type": "noul",\n    "instructions": "Does this convey urgency?"\n  },\n  "team": {\n    "type": "choice",\n    "instructions": "Which team should handle this?",\n    "criteria": {\n      "billing": "Payments, invoicing, refunds",\n      "technical": "Bugs, outages, integrations"\n    }\n  },\n  "frustration": {\n    "type": "score",\n    "instructions": "How frustrated is the customer?",\n    "criteria": ["Calm", "Frustrated", "Very angry"]\n  }\n}',
		description: 'Object mapping question ID to a question of type noul, choice, or score',
	},
];

export const outputProperties: INodeProperties[] = [
	{
		displayName: 'Output Format',
		name: 'outputFormat',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Simplified',
				value: 'simplified',
				description:
					'Flat fields per question, e.g. team, team_confidence, is_urgent, is_urgent_yes',
			},
			{
				name: 'Answers',
				value: 'answers',
				description: 'The typed answers plus model and usage',
			},
			{
				name: 'Raw Response',
				value: 'raw',
				description: 'The full response body from the endpoint',
			},
		],
		default: 'simplified',
	},
	{
		displayName: 'Route by Confidence',
		name: 'confidenceRouting',
		type: 'boolean',
		noDataExpression: true,
		default: false,
		description:
			'Whether to send items with any uncertain answer to a second "Uncertain" output, e.g. for human review',
	},
	{
		displayName: 'Confidence Threshold',
		name: 'confidenceThreshold',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
		displayOptions: { show: { confidenceRouting: [true] } },
		default: 0.7,
		description:
			'Items go to "Uncertain" when a choice or score confidence is below this value, or a noul is too close to 0.5 (certainty = |p − 0.5| × 2)',
	},
];

export const optionProperties: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Extra Body Fields (JSON)',
				name: 'extraBody',
				type: 'json',
				default: '{}',
				description:
					'Extra top-level fields merged into the request body, e.g. OpenRouter "provider" preferences or "trace"',
			},
			{
				displayName: 'Image Binary Fields',
				name: 'imageBinaryProperties',
				type: 'string',
				default: '',
				placeholder: 'e.g. data, image2',
				description:
					'Cloudflare Clef only: comma-separated binary fields holding PNG, JPEG, or WebP images to evaluate with the state (max 4)',
				displayOptions: { show: { '/provider': ['cloudflare'] } },
			},
			{
				displayName: 'Include Input Fields',
				name: 'includeInputFields',
				type: 'boolean',
				default: true,
				description: 'Whether to keep the fields of the input item in the output',
			},
			{
				displayName: 'Include Request',
				name: 'includeRequest',
				type: 'boolean',
				default: false,
				description: 'Whether to add the request body that was sent to the output, under _request',
			},
			{
				displayName: 'Noul Yes Threshold',
				name: 'noulThreshold',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
				default: 0.5,
				description:
					'Simplified output: a noul at or above this probability sets the matching "_yes" field to true',
			},
			{
				displayName: 'Put Output in Field',
				name: 'outputField',
				type: 'string',
				default: 'decision',
				description: 'Field the result is written to. Leave empty to write the result at the top level.',
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				description: 'OpenRouter only: groups related requests for observability',
				displayOptions: { show: { '/provider': ['openRouter'] } },
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 30000,
			},
			{
				displayName: 'User',
				name: 'user',
				type: 'string',
				default: '',
				description: 'OpenRouter only: an identifier for your end user',
				displayOptions: { show: { '/provider': ['openRouter'] } },
			},
		],
	},
];
