"""Integration checks against `astro preview`; geo is mocked only in local browser cases."""
import json
import os
import re
import tempfile
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('NICE_TEST_URL', 'http://127.0.0.1:4321').rstrip('/')
OUT = Path(os.environ.get('NICE_SCREENSHOTS', str(Path(tempfile.gettempdir()) / 'nice-i18n-screenshots')))
OUT.mkdir(parents=True, exist_ok=True)
STATUS = json.loads(Path('src/i18n/translation-status.json').read_text())
PREFIX = {'zh-CN': '', 'zh-Hant': '/zh-hant', 'en': '/en'}

class Tags(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.tags = []; self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

# Audit every published language/page, not just the representative browser pages.
for page_id, status in STATUS.items():
    for lang, prefix in PREFIX.items():
        path = prefix + ('/' if page_id == 'index' else '/' + page_id + '/')
        file = Path('dist') / path.strip('/') / 'index.html'
        tags = Tags(file.read_text()).tags
        ids = {a.get('id') for _, a in tags}
        assert next(a['lang'] for t, a in tags if t == 'html') == lang, path
        assert set(status['anchors'][lang]) <= ids, (path, 'anchor map mismatch', set(status['anchors'][lang]) - ids)
        canonical = next(a['href'] for t, a in tags if t == 'link' and a.get('rel') == 'canonical')
        assert canonical == 'https://docs.nicerobotics.hk' + path, (path, canonical)
        alternatives = {a.get('hreflang'): a['href'] for t, a in tags if t == 'link' and a.get('rel') == 'alternate'}
        assert set(PREFIX) <= set(alternatives), (path, alternatives)
        for t, a in tags:
            if t not in ('a', 'img'): continue
            href = a.get('href') if t == 'a' else a.get('src')
            if not href or href.startswith(('http:', 'https:', 'mailto:', 'data:')): continue
            parsed = urlparse(href)
            target_path = parsed.path or path
            if parsed.path.startswith('/assets/') or parsed.path.startswith('/downloads/'):
                assert (Path('public') / unquote(parsed.path).lstrip('/')).is_file(), (path, href)
            elif t == 'a' and (href.startswith('/') or href.startswith('#')):
                target = Path('dist') / target_path.strip('/') / 'index.html'
                assert target.is_file(), (path, href)
                if parsed.fragment:
                    target_ids = {x.get('id') for _, x in Tags(target.read_text()).tags}
                    assert unquote(parsed.fragment) in target_ids, (path, href, 'broken section link')
print(f'Static audit: all {len(STATUS) * len(PREFIX)} pages, resources, internal links, anchors, canonical and hreflang passed.', flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get('NICE_BROWSER_CHANNEL', 'chrome'), headless=True)
    page_errors = []
    def context(languages=None, saved=None, blocked=False, **kwargs):
        ctx = browser.new_context(**kwargs)
        ctx.on('page', lambda page: page.on('pageerror', lambda err: page_errors.append(str(err))))
        if languages:
            ctx.add_init_script('Object.defineProperty(navigator, "languages", {get: () => ' + json.dumps(languages) + '});')
        if blocked:
            ctx.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw new DOMException('Blocked','SecurityError')}}); Object.defineProperty(window, 'sessionStorage', {get(){throw new DOMException('Blocked','SecurityError')}});")
        elif saved:
            ctx.add_init_script('try { localStorage.setItem("nice-language", ' + json.dumps(json.dumps({'locale': saved, 'expiresAt': int(time.time()*1000)+86400000})) + '); } catch {}')
        return ctx

    cases = [
        (['zh-CN'], None, 'en', '/', 0),
        (['en-US', 'zh-CN'], None, 'en', '/', 0),
        (['zh-Hant'], None, 'en', '/zh-hant/', 0),
        (['en-GB'], None, 'zh-CN', '/en/', 0),
        (['zh-CN'], 'en', 'zh-CN', '/en/', 0),
        (['ja'], None, 'zh-CN', '/', 1),
        (['ja'], None, 'zh-Hant', '/zh-hant/', 1),
        (['ja'], None, 'en', '/en/', 1),
        (['ja'], None, None, '/', 1),
    ]
    for languages, saved, geo, expected, request_count in cases:
        ctx = context(languages, saved); hits = []
        ctx.route('**/api/locale', lambda route: (hits.append(1), route.fulfill(json={'locale': geo})))
        page = ctx.new_page(); page.goto(BASE + '/'); page.wait_for_url(BASE + expected); page.wait_for_load_state('networkidle')
        assert urlparse(page.url).path == expected and len(hits) == request_count, (languages, saved, page.url, hits)
        # Refresh and revisit from another document in the same session: no repeated auto-selection.
        if expected != '/':
            page.goto(BASE + '/', referer=BASE + expected); page.wait_for_load_state('networkidle')
            assert urlparse(page.url).path == '/'
        ctx.close()
    print('Homepage preference, browser ordering, geo fallback and repeat-visit scenarios passed.', flush=True)

    for path in ['/en/', '/zh-hant/', '/hardware/shim/', '/en/hardware/shim/', '/zh-hant/hardware/shim/']:
        ctx = context(['zh-CN'], saved='en'); hits = []
        ctx.route('**/api/locale', lambda route: (hits.append(1), route.fulfill(json={'locale':'zh-Hant'})))
        page=ctx.new_page();page.goto(BASE+path);page.wait_for_load_state('networkidle')
        assert urlparse(page.url).path == path and not hits
        ctx.close()

    # A slow response must not navigate after user input or after the timeout.
    for mode in ['interaction', 'manual', 'timeout', 'failure']:
        ctx = context(['ja']); page=ctx.new_page(); pending=[]
        if mode == 'failure': ctx.route('**/api/locale', lambda route: route.abort())
        else: ctx.route('**/api/locale', lambda route: pending.append(route))
        page.goto(BASE+'/', wait_until='domcontentloaded')
        page.wait_for_function("document.querySelector('button[data-open-modal]').disabled === false")
        if mode != 'failure':
            deadline=time.time()+5
            while not pending and time.time()<deadline: page.wait_for_timeout(20)
            assert pending
        if mode == 'interaction':
            page.keyboard.press('Tab'); pending[0].fulfill(json={'locale':'en'})
        elif mode == 'manual':
            page.locator('[data-language-select]').select_option('zh-Hant'); page.wait_for_url(BASE+'/zh-hant/')
            try: pending[0].fulfill(json={'locale':'en'})
            except Exception: pass  # The navigation may already have cancelled this request.
        elif mode == 'timeout':
            page.wait_for_timeout(1400)
            try: pending[0].fulfill(json={'locale':'en'})
            except Exception: pass
        page.wait_for_timeout(150)
        assert urlparse(page.url).path == ('/zh-hant/' if mode=='manual' else '/'), mode
        ctx.close()

    ctx=context(['zh-CN'], blocked=True);page=ctx.new_page();page.goto(BASE+'/')
    page.wait_for_load_state('networkidle');page.locator('[data-language-select]').select_option('en');page.wait_for_url(BASE+'/en/');ctx.close()
    print('Explicit URLs, slow geo, user interaction, failures and blocked storage passed.', flush=True)

    ctx=context(['zh-CN']);page=ctx.new_page()
    path='/wheels/roller-system/'; source=STATUS['wheels/roller-system']['anchors']
    page.goto(BASE+path+'?ref=language-test#'+source['zh-CN'][10]);page.wait_for_load_state('networkidle')
    for lang in ['en','zh-Hant','zh-CN']:
        page.locator('[data-language-select]').select_option(lang)
        page.wait_for_url(lambda url: urlparse(url).path == PREFIX[lang]+path)
        page.wait_for_load_state('networkidle')
        assert unquote(urlparse(page.url).fragment)==source[lang][10]
        assert urlparse(page.url).query=='ref=language-test'
    page.go_back();page.wait_for_load_state('networkidle')
    assert page.locator('[data-language-select]').input_value()=='zh-Hant'
    page.locator('[data-language-select]').focus();page.keyboard.press('Home');page.keyboard.press('Enter')
    ctx.close()

    paths=['/', '/transmission/gear/', '/hardware/tube-plugs/', '/structure/tube/', '/wheels/silicone-wheel/', '/wheels/roller-system/']
    for lang, prefix in PREFIX.items():
        for width, height in [(1440,900),(390,844)]:
            for theme in ['light','dark']:
                ctx=context(['zh-CN'], saved=lang, viewport={'width':width,'height':height}, color_scheme=theme)
                ctx.add_init_script('try { localStorage.setItem("starlight-theme", '+json.dumps(theme)+'); } catch {}')
                page=ctx.new_page()
                for path in paths:
                    page.goto(BASE+prefix+path);page.wait_for_load_state('networkidle')
                    assert page.locator('html').get_attribute('lang')==lang
                    select=page.locator('[data-language-select]');assert select.is_visible()
                    assert select.locator('option').all_text_contents()==['简体中文','繁體中文','English']
                    layout=page.evaluate("""() => ({overflow:document.documentElement.scrollWidth-innerWidth,
                      header:document.querySelector('.nice-header').getBoundingClientRect().bottom,
                      title:document.querySelector('h1').getBoundingClientRect().top})""")
                    assert layout['overflow']<=1 and layout['title']>=layout['header'], (lang,width,theme,path,layout)
                    for href in page.locator('.nice-section-nav a').evaluate_all('(els)=>els.map(a=>a.getAttribute("href"))'):
                        assert href.startswith(prefix+'/')
                    if path=='/':
                        assert not page.locator('html').get_attribute('data-has-sidebar')
                        if width==1440:page.screenshot(path=str(OUT/f'{lang}-{width}-{theme}-home.png'))
                    elif width==390:
                        page.locator('starlight-menu-button button').click()
                        assert page.locator('starlight-menu-button').get_attribute('aria-expanded')=='true'
                        for href in page.locator('#starlight__sidebar a').evaluate_all('(els)=>els.map(a=>a.getAttribute("href"))'):
                            assert href.startswith(prefix+'/'+path.strip('/').split('/')[0]+'/'), (lang,path,href)
                        page.locator('starlight-menu-button button').click()
                    if path=='/wheels/roller-system/' and width==390:
                        assert '**' not in page.locator('.sl-markdown-content').inner_text(), 'unparsed Markdown emphasis'
                        page.screenshot(path=str(OUT/f'{lang}-{width}-{theme}-roller.png'))
                ctx.close()
        # Search must load the right Pagefind language bundle and return local-language URLs.
        ctx=context(['zh-CN'], saved=lang);page=ctx.new_page();page.goto(BASE+prefix+'/');page.wait_for_load_state('networkidle')
        page.locator('button[data-open-modal]').click()
        field=page.locator('.pagefind-ui__search-input');field.wait_for()
        field.fill({'en':'gear','zh-CN':'齿轮','zh-Hant':'齒輪'}[lang])
        results=page.locator('.pagefind-ui__result-link');results.first.wait_for(timeout=15000)
        hrefs=results.evaluate_all('(els)=>els.map(a=>a.getAttribute("href"))')
        for href in hrefs:
            assert urlparse(href).path.startswith(prefix+'/')
            if lang=='zh-CN': assert not urlparse(href).path.startswith(('/en/','/zh-hant/'))
        ctx.close()
        print(f'{lang}: desktop/mobile × light/dark × six pages, menus and search passed.', flush=True)

    assert not page_errors, page_errors
    browser.close()
print(f'Browser acceptance passed. Screenshots: {OUT}', flush=True)
