import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';
import { splitPath, prefixes } from './i18n/locales';

const sectionPrefixes = ['transmission', 'hardware', 'structure', 'wheels'] as const;
let iconByHref: Map<string, string> | undefined;

type SidebarGroup = StarlightRouteData['sidebar'][number] & {
	type: 'group';
	entries: StarlightRouteData['sidebar'];
};

function getCurrentSection(id: string) {
	return sectionPrefixes.find((prefix) => id === prefix || id.startsWith(`${prefix}/`));
}

function isSidebarGroup(entry: StarlightRouteData['sidebar'][number] | undefined): entry is SidebarGroup {
	if (!entry) return false;
	return entry.type === 'group' && Array.isArray((entry as SidebarGroup).entries);
}

function filterOverview(route: StarlightRouteData) {
	if (!route.toc) return;
	route.toc.items = route.toc.items.filter((item) => item.slug !== '_top');
}

async function getIconByHref() {
	if (iconByHref) return iconByHref;
	const docs = await getCollection('docs');
	iconByHref = new Map(
		docs
			.filter((entry) => entry.data.icon)
			.map((entry) => [`/${entry.id ? `${entry.id}/` : ''}`, entry.data.icon as string])
	);
	return iconByHref;
}

function addSidebarIcons(entries: StarlightRouteData['sidebar'], icons: Map<string, string>) {
	for (const entry of entries) {
		if (entry.type === 'link') {
			const icon = icons.get(entry.href);
			if (icon) entry.attrs = { ...entry.attrs, 'data-icon': icon };
		}
		if (isSidebarGroup(entry)) addSidebarIcons(entry.entries, icons);
	}
}

function filterSidebar(route: StarlightRouteData) {
	const { locale, path } = splitPath(`/${route.id}`);
	const id = path.replace(/^\//, '');
	if (id === '') {
		route.hasSidebar = false;
		route.toc = undefined;
		route.sidebar = [];
		return;
	}

	const section = getCurrentSection(id);
	if (!section) return;

	const sectionGroup = route.sidebar.find((entry) => {
		if (!isSidebarGroup(entry)) return false;
		return entry.entries.some((child) => child.type === 'link' && child.href.startsWith(`${prefixes[locale]}/${section}/`));
	});

	if (isSidebarGroup(sectionGroup)) {
		route.sidebar = sectionGroup.entries;
	}
}

export const onRequest = defineRouteMiddleware(async (context, next) => {
	await next();
	const route = context.locals.starlightRoute;
	addSidebarIcons(route.sidebar, await getIconByHref());
	filterSidebar(route);
	filterOverview(route);
});
