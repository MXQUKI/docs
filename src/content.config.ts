import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				icon: z.string().optional(),
				titleAction: z.object({ label: z.string(), href: z.string() }).optional(),
			}),
		}),
	}),
	i18n: defineCollection({
		loader: i18nLoader(),
		schema: i18nSchema({ extend: z.object({
			'nice.home': z.string(),
			'nice.transmission': z.string(),
			'nice.hardware': z.string(),
			'nice.structure': z.string(),
			'nice.wheels': z.string(),
			'nice.shop': z.string(),
			'nice.onshape': z.string(),
			'nice.categories': z.string(),
			'nice.contact': z.string(),
			'nice.buy': z.string(),
			'application.start': z.string(),
			'application.preview': z.string(),
			'application.loading': z.string(),
			'application.unavailable': z.string(),
			'application.loadError': z.string(),
			'application.retry': z.string(),
			'application.submitting': z.string(),
			'application.pending': z.string(),
			'application.synced': z.string(),
			'application.receipt': z.string(),
			'application.failed': z.string(),
			'application.invalid': z.string(),
			'application.closed': z.string(),
			'application.terminated': z.string(),
			'application.back': z.string(),
			'application.draft': z.string(),
			'application.clear': z.string(),
			'application.confirmClear': z.string(),
			'application.privacy': z.string(),
			'application.consent': z.string(),
			'application.stale': z.string(),
			'application.storage': z.string(),
			'application.limits': z.string(),
			'application.length': z.string(),
			'application.checking': z.string(),
			'application.statusError': z.string(),
			'application.checkStatus': z.string(),
			'application.required': z.string(),
			'application.review': z.string(),
			'application.submit': z.string(),
			'application.submitNote': z.string(),
			'application.label': z.string(),
			'application.javascript': z.string(),
		}) }),
	}),
};
