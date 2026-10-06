import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import type { EndpointCredentials } from './request';

const trimSlash = (url: string) => url.trim().replace(/\/+$/, '');

function byName(a: INodePropertyOptions, b: INodePropertyOptions): number {
	return a.name.localeCompare(b.name);
}

/** Parses an OpenAI-style `{ data: [{ id, name?, description? }] }` model listing. */
export function parseModelList(response: unknown, filter: (id: string) => boolean = () => true): INodePropertyOptions[] {
	const data = (response as { data?: unknown })?.data;
	if (!Array.isArray(data)) return [];
	const options: INodePropertyOptions[] = [];
	for (const model of data as Array<{ id?: unknown; name?: unknown; description?: unknown }>) {
		if (typeof model?.id !== 'string' || !filter(model.id)) continue;
		options.push({
			name: typeof model.name === 'string' && model.name ? model.name : model.id,
			value: model.id,
			description: typeof model.description === 'string' ? model.description.slice(0, 200) : undefined,
		});
	}
	return options.sort(byName);
}

/** Parses a Workers AI `/ai/models/search` response, keeping System One (Clef) models. */
export function parseCloudflareModels(response: unknown): INodePropertyOptions[] {
	const result = (response as { result?: unknown })?.result;
	if (!Array.isArray(result)) return [];
	return (result as Array<{ name?: unknown; description?: unknown }>)
		.filter((model) => typeof model?.name === 'string' && /\/clef(-|$)/.test(model.name))
		.map((model) => ({
			name: model.name as string,
			value: model.name as string,
			description: typeof model.description === 'string' ? model.description.slice(0, 200) : undefined,
		}))
		.sort(byName);
}

export const isSystemOneOpenRouterModel = (id: string) => /(^|~)typesafe\//.test(id);

export async function getTypeSafeModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const credentials = (await this.getCredentials('typeSafeApi')) as EndpointCredentials;
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'typeSafeApi', {
		method: 'GET',
		url: `${trimSlash(credentials.baseUrl || 'https://api.typesafe.ai')}/v1/models`,
		json: true,
	});
	return parseModelList(response);
}

export async function getOpenRouterModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const credentials = (await this.getCredentials('systemOneOpenRouterApi')) as EndpointCredentials;
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'systemOneOpenRouterApi', {
		method: 'GET',
		url: `${trimSlash(credentials.baseUrl || 'https://openrouter.ai')}/api/v1/models`,
		json: true,
	});
	return parseModelList(response, isSystemOneOpenRouterModel);
}

export async function getCloudflareModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const credentials = (await this.getCredentials('systemOneCloudflareApi')) as EndpointCredentials;
	const response = await this.helpers.httpRequestWithAuthentication.call(this, 'systemOneCloudflareApi', {
		method: 'GET',
		url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent((credentials.accountId ?? '').trim())}/ai/models/search`,
		qs: { search: 'clef', per_page: 100 },
		json: true,
	});
	return parseCloudflareModels(response);
}
