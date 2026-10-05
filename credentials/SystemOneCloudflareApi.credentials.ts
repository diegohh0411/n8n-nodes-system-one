import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SystemOneCloudflareApi implements ICredentialType {
	name = 'systemOneCloudflareApi';

	displayName = 'Cloudflare Workers AI (System One) API';

	icon: Icon = { light: 'file:../nodes/SystemOne/systemOne.svg', dark: 'file:../nodes/SystemOne/systemOne.dark.svg' };

	documentationUrl = 'https://developers.cloudflare.com/workers-ai/models/clef/';

	properties: INodeProperties[] = [
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			required: true,
			default: '',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'A Cloudflare API token with Workers AI permissions',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.cloudflare.com/client/v4',
			url: '=/accounts/{{$credentials.accountId}}/ai/models/search',
			qs: { per_page: 1 },
			method: 'GET',
		},
	};
}
