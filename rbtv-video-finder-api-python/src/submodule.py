from pyodide.http import pyfetch
from urllib.parse import urlparse, quote
import json
import random
import string
import unicodedata
import re
from pyodide.http import pyfetch
from datetime import datetime
import sys
import asyncio

locale_list = [
    "us","gb","de","at","ch","fr","it","es","nl","se","no","dk","fi",
    "ca","au","nz","jp","kr","sg","ae","be","ie","pt","cz","pl","hu",
    "ro","gr","tr","tw","mx","br","ar","cl","co","pe","za","hk","th",
    "my","id","ph","vn","in","pk","bd","lk","np","ke","ng","gh","tz",
    "ug","ua","kz","rs","bg","hr","sk","si","sa","qa","kw","om","jo",
    "lb","ma","tn","dz","ad","ag","ai","al","am","ao","aq","as","aw",
    "ax","az","ba","bb","bf","bh","bi","bj","bl","bm","bn","bo","bq",
    "bs","bt","bv","bw","bz","cc","cd","cf","cg","ci","ck","cm","cv",
    "cw","cx","cy","dj","dm","do","ec","ee","eg","eh","fj","fk","fm",
    "fo","ga","gd","ge","gf","gg","gi","gl","gm","gn","gp","gq","gs",
    "gt","gu","gw","gy","hm","hn","ht","il","im","io","iq","is","je",
    "jm","kg","kh","ki","km","kn","ky","la","lc","li","lr","ls","lt",
    "lu","lv","ly","mc","md","me","mf","mg","mh","mk","ml","mn","mo",
    "mp","mq","mr","ms","mt","mu","mv","mw","mz","na","nc","ne","nf",
    "ni","nr","nu","pa","pf","pg","pm","pn","pr","ps","pw","py","re",
    "rw","sb","sc","sd","sh","sj","sl","sm","sn","so","sr","ss","st",
    "sv","sx","sz","tc","td","tf","tg","tj","tk","tl","to","tt","tv",
    "um","uy","uz","va","vc","vg","vi","vu","wf","ws","ye","yt","zm",
    "zw","cn","ir","kp","sy","tm","er","cu","ve","ru","by","af","mm"
]

language_locale_list = [
    'en_INT', 'en_AU', 'en_CA', 'en_EU', 'en_GB',
    'en_IE', 'en_IN', 'en_KE', 'en_MY', 'en_NG', 
    'en_NZ', 'en_PH', 'en_PK', 'en_SE', 'en_SG', 
    'en_US', 'en_ZA', 'fr_CA', 'fr_CH', 'fr_FR',
    'es_INT', 'es_AR', 'es_CL', 'es_CO', 'es_ES',
    'es_MX', 'es_PE', 'de_INT', 'de_AT', 'de_CH',
    'de_DE', 'bg_BG', 'et_EE', 'hu_HU', 'id_ID',
    'it_IT', 'ja_JP', 'ko_KR', 'mk_MK', 'nl_NL',
    'pl_PL', 'pt_BR', 'ru_RU', 'sq_AL', 'sr_ME',
    'tr_TR', 'uk_UA'
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Accept": "application/json, text/plain, */*",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "sec-ch-ua": '"Chromium";v="144", "Not(A:Brand";v="24", "Google Chrome";v="144"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
    "Referer": "https://www.redbull.com",
    "Origin": "https://www.redbull.com"
}

def log_error(message):
    timestamp = datetime.now().strftime('[%d/%b/%Y %H:%M:%S]')
    sys.stderr.write(f"\033[31m{timestamp} \"ERROR: {message}\"\033[0m\n")

def log_info(message):
    timestamp = datetime.now().strftime('[%d/%b/%Y %H:%M:%S]')
    print(f"{timestamp} \"INFO: {message}\"", flush=True)

def sanitize_video_title(video_title: str) -> str:
    video_title = unicodedata.normalize("NFC", video_title)
    video_title = re.sub(r'[\\/*?:"<>|]', '_', video_title)
    video_title = re.sub(r'_+', '_', video_title)
    video_title = video_title.strip(". ")
    return video_title[:150]

def get_locale_priority(ll, page_url=""):
    if ll == 'en_INT' or (page_url and 'int-en' in page_url):
        return 0
    
    if ll.startswith('en_'):
        return 1
    
    latin_locales = ['fr', 'es', 'de', 'it', 'nl', 'pt', 'tr', 'pl', 'id', 'ms', 'vi']
    if any(ll.startswith(prefix) for prefix in latin_locales):
        return 2
    
    non_latin_prefixes = ['ja', 'ko', 'ru', 'ar', 'th', 'hi', 'zh', 'bg', 'uk', 'mk', 'sr']
    if any(ll.startswith(prefix) for prefix in non_latin_prefixes):
        return 3
    return 4

async def follow_redirect(base_url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Accept": "application/json, text/plain, */*",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "sec-ch-ua": '"Chromium";v="144", "Not(A:Brand";v="24", "Google Chrome";v="144"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1",
        "Referer": base_url,
        "Origin": "https://www.redbull.com"
    }
    response = await pyfetch(base_url, method="GET", headers=headers)
    if response.url != base_url:
        log_info(f"Redirected to [{response.url}]")
        return response.url
    return base_url

async def fetch_category_recursive(base_url, cat, q):
    all_cards = []
    offset = 0
    page_size = 15
    while True:
        url = f"{base_url}/{cat}?offset={offset}&q={quote(q)}"
        try:
            resp = await pyfetch(url, method="GET", headers=headers)
            if not resp.ok:
                break
            data = await resp.json()
            cards = data.get("cards", [])
            if not cards:
                break
            all_cards.extend(cards)
            if len(cards) < page_size:
                break
            offset += page_size
            if offset >= 75:
                break
        except Exception as e:
            log_error(f"Pagination error for {cat} at offset {offset}: {e}")
            break  
    return all_cards

async def get_search_result(q, start=0, end=None):
    results_map = {}
    coros = []
    
    if start >= len(language_locale_list):
        return []
    if end is None:
        end = len(language_locale_list)

    for ll in language_locale_list[start:end]:
        parts = ll.split('_')
        locale = parts[1] if len(parts) > 1 else parts[0]
        base_url = f"https://tv-api.redbull.com/search/v5/rbtv/{ll}/{locale}"
        
        for cat in ["films", "videos"]:
            async def wrapped_fetch(b_url, category, query, lang_locale):
                cards = await fetch_category_recursive(b_url, category, query)
                return cards, lang_locale
            
            coros.append(wrapped_fetch(base_url, cat, q, ll))

    for finished_task in asyncio.as_completed(coros):
        try:
            cards, ll = await finished_task
            if not cards:
                continue

            current_priority = get_locale_priority(ll)

            for card in cards:
                if card.get("type") == "page":
                    continue
                
                raw_id = card.get("id") or ""
                norm_id = raw_id.replace("page:", "")
                if not norm_id:
                    continue

                year = card.get("year")
                is_future = False
                if not year:
                    start_time = card.get("start_time")
                    if start_time:
                        is_future = True
                        try:
                            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                            year = dt.year
                        except:
                            year = 0

                new_entry = {
                    "id": card.get("id"),
                    "title": card.get("title"),
                    "subheading": card.get("subheading"),
                    "thumbnail": card.get('media_resources', {}).get('rbtv_display_art_landscape', {}).get('url'),
                    "duration": card.get("duration"),
                    "page_url": card.get("share_url"),
                    "year": int(year) if str(year).isdigit() else 0,
                    "is_future": is_future,
                    "priority": current_priority
                }

                if norm_id not in results_map or current_priority < results_map[norm_id]["priority"]:
                    results_map[norm_id] = new_entry

        except Exception as e:
            log_error(f"Search request failed: {e}")

    final_list = list(results_map.values())
    return final_list

async def fetch_search_category(url):
    resp = await pyfetch(url, method="GET", headers=headers)
    if resp.ok:
        data = await resp.json()
        return data.get("cards", [])
    return []

async def get_video_from_id(video_id):
    tv_api = f"https://tv-api.redbull.com/products/dynamic/v5.1/rbtv/en/int/{video_id}"
    resp = await pyfetch(tv_api, method="GET", headers=headers)
    stream_id = None
    locale = "int"

    if resp.ok:
        try:
            json_data = await resp.json()
            links = json_data.get('links') or []
            if links:
                stream_id = links[0].get('id')
        except Exception:
            pass

    if not stream_id:
        async def scan_stream_id_locale(loc):
            api = f"https://tv-api.redbull.com/products/dynamic/v5.1/rbtv/en/{loc}/{video_id}"
            try:
                r = await pyfetch(api, method="GET", headers=headers)
                if r.ok:
                    data = await r.json()
                    links = data.get('links')
                    if links and links[0].get('id'):
                        return {"locale": loc, "stream_id": links[0].get('id')}
            except:
                pass
            return None

        # Ensure locale_list is defined globally or passed in
        coros = [scan_stream_id_locale(l) for l in locale_list[start:end]]
        for finished_task in asyncio.as_completed(coros):
            res = await finished_task
            if res:
                stream_id = res['stream_id']
                locale = res['locale']
                break

    if stream_id:
        video_url_api = f"https://play.redbull.com/init/v1/rbtv/en/{locale}/personal_computer/http/{stream_id}"
        v_resp = await pyfetch(video_url_api, method="GET", headers=headers)
        if v_resp.ok:
            try:
                v_data = await v_resp.json()
                video_url = v_data.get('manifest_url')
            except:
                video_url = None
        else:
            video_url = None
    else:
        video_url = None

    return video_url, locale, stream_id

async def get_title_from_url(base_url_init, start=0, end=None):
    if start >= len(locale_list):
        return []
    if end is None:
        end = len(locale_list)

    base_url = await follow_redirect(base_url_init)
    path = urlparse(base_url).path
    segments = [s for s in path.split('/') if s]
    video_id = next((re.search(r'(rrn:content:.*)', s).group(1) for s in segments if 'rrn:content' in s), None)

    if video_id:
        try:
            video_url, locale, stream_id = await get_video_from_id(video_id)
            video_thumbnail = None
            video_title_raw = None
            subheading_raw = None

            if stream_id:
                meta_url_api = f"https://tv-api.redbull.com/products/v5.1/rbtv/en/{locale}/{stream_id}"
                m_resp = await pyfetch(meta_url_api, method="GET", headers=headers)

                if not m_resp.ok:
                    async def scan_title_locale(loc):
                        api = f"https://tv-api.redbull.com/products/v5.1/rbtv/en/{loc}/{stream_id}"
                        try:
                            r = await pyfetch(api, method="GET", headers=headers)
                            if r.ok:
                                d = await r.json()
                                if d and d.get('title'):
                                    return {
                                        "locale": loc,
                                        "title": d.get('title'),
                                        "thumb": d.get('media_resources', {}).get('rbtv_display_art_landscape', {}).get('url'),
                                        "sub": d.get('subheading')
                                    }
                        except:
                            pass
                        return None

                    coros = [scan_title_locale(l) for l in locale_list[start:end]]
                    for finished_task in asyncio.as_completed(coros):
                        res = await finished_task
                        if res:
                            video_title_raw = res['title']
                            video_thumbnail = res['thumb']
                            subheading_raw = res['sub']
                            break
                else:
                    meta_json = await m_resp.json()
                    video_title_raw = meta_json.get('title')
                    video_thumbnail = meta_json.get('media_resources', {}).get('rbtv_display_art_landscape', {}).get('url')
                    subheading_raw = meta_json.get('subheading')

            subheading = sanitize_video_title(subheading_raw) if subheading_raw else None
            title = sanitize_video_title(video_title_raw) if video_title_raw else None
            
            if video_url:
                log_info(f"M3U Stream found for [{base_url}], Video_ID=[{video_id}] Title=[{title}], Subheading=[{subheading}] Stream=[{video_url}], Thumbnail=[{video_thumbnail}]")
                return title, video_url, video_thumbnail, video_id, subheading, base_url

        except Exception as e:
            log_info(f"V5.1 API lookup failed for [{video_id}], falling back to legacy API: {e}")

    url_slug = path.lstrip('/')
    category_raw = path.rstrip('/').split('/')[-2] if '/' in path.rstrip('/') else "videos"
    category_map = {"live": "live-videos", "episodes": "episode-videos", "films": "films", "videos": "videos"}
    category = category_map.get(category_raw, category_raw)

    try:
        loc_res = await pyfetch("https://www.redbull.com/v3/config/pages?url=" + url_slug, method="GET", headers=headers)
        if not loc_res.ok:
            raise ValueError(f"Config API returned {loc_res.status}")
            
        loc_data = await loc_res.json()
        locales = loc_data.get("data", {}).get("domainConfig", {}).get("supportedLocales", [])
        if not locales: locales = ["en-INT"]
        selected_locale = next((l for l in locales if "en" in l.lower()), locales[0])
        
        meta_url = f"https://www.redbull.com/v3/api/graphql/v1/v3/feed/{selected_locale}?disableUsageRestrictions=true&filter[type]={category}&filter[uriSlug]={url_slug.split('/')[-1]}&rb3Schema=v1:pageConfig&rb3PageUrl=/{url_slug}"
        m_res = await pyfetch(meta_url, method="GET", headers=headers)
        if not m_res.ok:
            raise ValueError(f"GraphQL API returned {m_res.status}")
            
        m_data = await m_res.json()
        video_data = m_data.get('data', {})
        video_id_legacy = video_data.get('id')
        video_thumbnail = video_data.get('pageMeta', {}).get('og:image')
        
        v_url_api = f"https://api-player.redbull.com/rbcom/videoresource?videoId={video_id_legacy}&localeMixing={selected_locale}"
        v_res = await pyfetch(v_url_api, method="GET", headers=headers)
        if not v_res.ok:
            raise ValueError(f"Player API returned {v_res.status}")
            
        v_data = await v_res.json()
        video_url = v_data.get('videoUrl')
        video_title_raw = v_data.get('title')
        title = sanitize_video_title(video_title_raw) if video_title_raw else 'rbtv-' + ''.join(random.choices(string.ascii_letters, k=8))
        
        return title, video_url, video_thumbnail, video_id_legacy.rsplit(':', 1)[0] if video_id_legacy else None, None, base_url
    except Exception as e:
        log_error(f"Unable to fetch metadata: {e}")
        return None, None, None, None, None, base_url