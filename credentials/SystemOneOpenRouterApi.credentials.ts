import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SystemOneOpenRouterApi implements ICredentialType {
	name = 'systemOneOpenRouterApi';

	displayName = 'OpenRouter (System One) API';

	icon: Icon = { light: 'file:../nodes/SystemOne/systemOne.svg', dark: 'file:../nodes/SystemOne/systemOne.dark.svg' };

	documentationUrl = 'https://openrouter.ai/docs/guides/community/jev';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://openrouter.ai',
			description: 'Base URL of OpenRouter, without the /api suffix',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/key',
			method: 'GET',
		},
	};
}
