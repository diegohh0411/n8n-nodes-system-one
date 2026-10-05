import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SystemOneCustomApi implements ICredentialType {
	name = 'systemOneCustomApi';

	displayName = 'System One Custom Endpoint API';

	icon: Icon = { light: 'file:../nodes/SystemOne/systemOne.svg', dark: 'file:../nodes/SystemOne/systemOne.dark.svg' };

	documentationUrl = 'https://docs.typesafe.ai/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Endpoint URL',
			name: 'url',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'https://example.com/v1/systemone',
			description: 'Full URL of a System One compatible endpoint (accepts POST with state, model and questions)',
		},
		{
			displayName: 'Header Name',
			name: 'headerName',
			type: 'string',
			default: 'Authorization',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'Bearer sk-...',
			description: 'Value sent in the header above, including any "Bearer " prefix. Leave empty for unauthenticated endpoints.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'={{$credentials.headerName}}': '={{$credentials.apiKey}}',
			},
		},
	};

	// System One has no standard read-only endpoint, so the test sends a minimal evaluation.
	test: ICredentialTestRequest = {
		request: {
			url: '={{$credentials.url}}',
			method: 'POST',
			body: {
				model: 'jev-latest',
				state: 'ping',
				questions: { ok: { type: 'noul', instructions: 'Is this a test?' } },
			},
		},
	};
}
