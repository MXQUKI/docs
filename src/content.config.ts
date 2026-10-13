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
		}) }),
	}),
};
