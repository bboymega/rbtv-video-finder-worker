/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

const locale_list = ["us","gb","de","at","ch","fr","it","es","nl","se","no","dk","fi","ca","au","nz","jp","kr","sg","ae","be","ie","pt","cz","pl","hu","ro","gr","tr","tw","mx","br","ar","cl","co","pe","za","hk","th","my","id","ph","vn","in","pk","bd","lk","np","ke","ng","gh","tz","ug","ua","kz","rs","bg","hr","sk","si","sa","qa","kw","om","jo","lb","ma","tn","dz","ad","ag","ai","al","am","ao","aq","as","aw","ax","az","ba","bb","bf","bh","bi","bj","bl","bm","bn","bo","bq","bs","bt","bv","bw","bz","cc","cd","cf","cg","ci","ck","cm","cv","cw","cx","cy","dj","dm","do","ec","ee","eg","eh","fj","fk","fm","fo","ga","gd","ge","gf","gg","gi","gl","gm","gn","gp","gq","gs","gt","gu","gw","gy","hm","hn","ht","il","im","io","iq","is","je","jm","kg","kh","ki","km","kn","ky","la","lc","li","lr","ls","lt","lu","lv","ly","mc","md","me","mf","mg","mh","mk","ml","mn","mo","mp","mq","mr","ms","mt","mu","mv","mw","mz","na","nc","ne","nf","ni","nr","nu","pa","pf","pg","pm","pn","pr","ps","pw","py","re","rw","sb","sc","sd","sh","sj","sl","sm","sn","so","sr","ss","st","sv","sx","sz","tc","td","tf","tg","tj","tk","tl","to","tt","tv","um","uy","uz","va","vc","vg","vi","vu","wf","ws","ye","yt","zm","zw","cn","ir","kp","sy","tm","er","cu","ve","ru","by","af","mm"];

const language_locale_list = ['en_INT', 'en_AU', 'en_CA', 'en_EU', 'en_GB', 'en_IE', 'en_IN', 'en_KE', 'en_MY', 'en_NG', 'en_NZ', 'en_PH', 'en_PK', 'en_SE', 'en_SG', 'en_US', 'en_ZA', 'fr_CA', 'fr_CH', 'fr_FR', 'es_INT', 'es_AR', 'es_CL', 'es_CO', 'es_ES', 'es_MX', 'es_PE', 'de_INT', 'de_AT', 'de_CH', 'de_DE', 'bg_BG', 'et_EE', 'hu_HU', 'id_ID', 'it_IT', 'ja_JP', 'ko_KR', 'mk_MK', 'nl_NL', 'pl_PL', 'pt_BR', 'ru_RU', 'sq_AL', 'sr_ME', 'tr_TR', 'uk_UA'];

const headers = {
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
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const log_error = (msg) => console.error(`[${new Date().toISOString()}] "ERROR: ${msg}"`);
const log_info = (msg) => console.log(`[${new Date().toISOString()}] "INFO: ${msg}"`);

function get_locale_priority(ll) {
    if (ll === 'en_INT') return 0;
    if (ll.startsWith('en_')) return 1;
    const romanLocales = ['fr_', 'de_', 'es_', 'it_', 'nl_', 'pt_', 'pl_'];
    if (romanLocales.some(prefix => ll.startsWith(prefix))) {
        return 2;
    }
    return 3;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

        try {
            if (url.pathname === "/api/search") {
                const q = url.searchParams.get("q");
                const start = parseInt(url.searchParams.get("start") || "0");
                const end = url.searchParams.get("end") ? parseInt(url.searchParams.get("end")) : (start + 5);
                if (!q) return Response.json({ status: "error", message: "Missing q" }, { status: 400, headers: CORS_HEADERS });

                const results = await get_search_result(decodeURIComponent(q), start, end);
                return Response.json({ status: "success", results }, { headers: CORS_HEADERS });
            }

            if (url.pathname === "/api/stream") {
                const video_id = url.searchParams.get("id");
                const [video_url, stream_id] = await get_video_from_id(video_id); 
                
                if (video_url) {
                    log_info(`M3U Stream found for [${video_id}], Stream=[${video_url}]`);
                    return Response.json({ status: "success", stream: video_url }, { headers: CORS_HEADERS });
                }
                log_error(`M3U Stream not found for [${video_id}]`);
                return Response.json({ status: "error", message: "M3U stream not found" }, { status: 404, headers: CORS_HEADERS });
            }

            if (url.pathname === "/api/parse") {
                const target_url = url.searchParams.get("url");
                if (!target_url) return Response.json({ status: "error", message: "Missing url" }, { status: 400, headers: CORS_HEADERS });
                
                const start = parseInt(url.searchParams.get("start") || "0");
                const res = await get_title_from_url(target_url, start, start + 5);
                
                if (res[0] || res[1]) {
                    return Response.json({
                        status: "success", 
                        title: res[0], 
                        subheading: res[4], 
                        stream: res[1], 
                        thumbnail: res[2],
                        id: res[3],
                        url: res[5]
                    }, { headers: CORS_HEADERS });
                } else {
                    return Response.json({ status: "error", message: "Video not found" }, { status: 404, headers: CORS_HEADERS });
                }
            }

        } catch (e) {
            log_error(e.message);
            return Response.json({ status: "error", message: e.message }, { status: 500, headers: CORS_HEADERS });
        }

        return Response.json({ status: "error", message: "Endpoint not found" }, { status: 404, headers: CORS_HEADERS });
    }
};

async function fetch_category_recursive(base_url, cat, q) {
    let all_cards = [];
    let offset = 0;
    const page_size = 15;
    while (offset <= 120) {
        const url = `${base_url}/${cat}?offset=${offset}&q=${encodeURIComponent(q)}`;
        try {
            const resp = await fetch(url, { headers });
            if (!resp.ok) break;
            const data = await resp.json();
            const cards = data.cards || [];
            if (cards.length === 0) break;
            all_cards.push(...cards);
            if (cards.length < page_size) break;
            offset += page_size;
        } catch (e) {
            log_error(`Pagination error for [${cat}] at offset ${offset}: ${e.message}`);
            break;
        }
    }
    return all_cards;
}

async function get_search_result(q, start, end) {
    const results_map = new Map();
    const selected = language_locale_list.slice(start, end);
    
    const tasks = selected.flatMap(ll => {
        const parts = ll.split('_');
        const locale = parts[1] || parts[0];
        const base = `https://tv-api.redbull.com/search/v5/rbtv/${ll}/${locale}`;
        return [
            fetch_category_recursive(base, 'films', q).then(cards => ({ cards, ll })),
            fetch_category_recursive(base, 'videos', q).then(cards => ({ cards, ll }))
        ];
    });

    const chunks = await Promise.all(tasks);
    for (const { cards, ll } of chunks) {
        const priority = get_locale_priority(ll);
        for (const card of cards) {
            if (card.type === "page") continue;
            const norm_id = (card.id || "").replace("page:", "");
            if (!norm_id) continue;

            if (!results_map.has(norm_id) || priority < results_map.get(norm_id).priority) {
                results_map.set(norm_id, {
                    id: card.id, title: card.title, subheading: card.subheading,
                    thumbnail: card.media_resources?.rbtv_display_art_landscape?.url,
                    duration: card.duration, page_url: card.share_url,
                    year: card.year || (card.start_time ? new Date(card.start_time).getFullYear() : 0),
                    priority: priority
                });
            }
        }
    }
    return Array.from(results_map.values());
}

async function get_video_from_id(video_id) {
    const api = `https://tv-api.redbull.com/products/dynamic/v5.1/rbtv/en/int/${video_id}`;
    const resp = await fetch(api, { headers });
    let stream_id = null;

    if (resp.ok) {
        const data = await resp.json();
        stream_id = data.links?.[0]?.id;
    }
    
    if (stream_id) {
        const v_api = `https://play.redbull.com/init/v1/rbtv/en/int/personal_computer/http/${stream_id}`;
        const v_res = await fetch(v_api, { headers });
        if (v_res.ok) {
            const v_data = await v_res.json();
            return [v_data.manifest_url, stream_id];
        }
    }
    return [null, null];
}

async function get_title_from_url(base_url_init, start = 0, end = null) {
    if (start >= locale_list.length) return [null, null, null, null, null, base_url_init];
    const actual_end = end === null ? locale_list.length : end;

    let final_url = base_url_init;
    let path = "";
    let segments = [];

    try {
        const head = await fetch(base_url_init, { method: "GET", redirect: "follow", headers: headers });
        final_url = head.url;
        const url_obj = new URL(final_url);
        path = url_obj.pathname;
        segments = path.split('/').filter(s => s);
    } catch (e) {
        log_error(`Redirect failed for [${base_url_init}]: ${e.message}`);
    }
    
    const video_id = path.match(/(rrn:content:[^/]+)/)?.[1];
    log_info(`Processing URL: [${final_url}], ID extracted: [${video_id}]`);

    if (video_id) {
        try {
            let [video_url, stream_id] = await get_video_from_id(video_id);

            if (!stream_id) {
                const scan_locales = locale_list.slice(start, actual_end);
                for (const loc of scan_locales) {
                    const api = `https://tv-api.redbull.com/products/dynamic/v5.1/rbtv/en/${loc}/${video_id}`;
                    try {
                        const r = await fetch(api, { headers });
                        if (r.ok) {
                            const data = await r.json();
                            if (data.links?.[0]?.id) {
                                stream_id = data.links[0].id;
                                const v_api = `https://play.redbull.com/init/v1/rbtv/en/${loc}/personal_computer/http/${stream_id}`;
                                const v_res = await fetch(v_api, { headers });
                                if (v_res.ok) {
                                    const v_data = await v_res.json();
                                    video_url = v_data.manifest_url;
                                }
                                break; 
                            }
                        }
                    } catch (e) { continue; }
                }
            }

            if (stream_id) {
                let meta_url = `https://tv-api.redbull.com/products/v5.1/rbtv/en/${locale}/${stream_id}`;
                let m_resp = await fetch(meta_url, { headers });
                let m_data;

                if (!m_resp.ok) {
                    const scan_locales = locale_list.slice(start, actual_end);
                    for (const loc of scan_locales) {
                        const api = `https://tv-api.redbull.com/products/v5.1/rbtv/en/${loc}/${stream_id}`;
                        const r = await fetch(api, { headers });
                        if (r.ok) {
                            m_data = await r.json();
                            if (m_data.title) break;
                        }
                    }
                } else {
                    m_data = await m_resp.json();
                }

                if (m_data) {
                    log_info(`Video found for [${final_url}], Video_ID=[${video_id}] Title=[${m_data.title}], Subheading=[${m_data.subheading}] Stream=[${video_url}], Thumbnail=[${m_data.media_resources?.rbtv_display_art_landscape?.url}]`)
                    return [m_data.title, video_url, m_data.media_resources?.rbtv_display_art_landscape?.url, video_id, m_data.subheading, final_url];
                }
            }
        } catch (e) {
            log_error(`V5.1 API lookup failed for [${video_id}]: ${e.message}`);
        }
    }

    try {
        const url_slug = path.replace(/^\//, '');
        const category_raw = segments.length >= 2 ? segments[segments.length - 2] : "videos";
        const category_map = {"live": "live-videos", "episodes": "episode-videos", "films": "films", "videos": "videos"};
        const category = category_map[category_raw] || category_raw;

        const config_res = await fetch(`https://www.redbull.com/v3/config/pages?url=${url_slug}`, { headers });
        if (config_res.ok) {
            const config = await config_res.json();
            const locales = config.data?.domainConfig?.supportedLocales || ["en-INT"];
            const selected_locale = locales.find(l => l.toLowerCase().includes("en")) || locales[0];

            const gql = `https://www.redbull.com/v3/api/graphql/v1/v3/feed/${selected_locale}?disableUsageRestrictions=true&filter[type]=${category}&filter[uriSlug]=${url_slug.split('/').pop()}&rb3Schema=v1:pageConfig&rb3PageUrl=/${url_slug}`;
            const m_res = await fetch(gql, { headers });
            if (m_res.ok) {
                const m_data = await m_res.json();
                const v_data = m_data.data || {};
                const legacy_id = v_data.id;
                const thumb = v_data.pageMeta?.["og:image"];

                const v_url_api = `https://api-player.redbull.com/rbcom/videoresource?videoId=${legacy_id}&localeMixing=${selected_locale}`;
                const v_res = await fetch(v_url_api, { headers });
                if (v_res.ok) {
                    const final_v = await v_res.json();
                    log_info(`Video found for [${final_url}], Video_ID=[${legacy_id?.split(':')?.[0]}] Title=[${final_v.title}], Subheading=[${null}] Stream=[${final_v.videoUrl}], Thumbnail=[${m_data.media_resources?.rbtv_display_art_landscape?.url}]`)
                    return [final_v.title, final_v.videoUrl, thumb, legacy_id?.split(':')?.[0], null, final_url];
                }
            }
        }
    } catch (e) {
        log_error(`Legacy GraphQL fallback failed: ${e.message}`);
    }
    
    const stream = await get_video_from_id(video_id)
    if(stream[0]) {
        log_info(`Fallback found for [${final_url}], Stream=[${stream[0]}]`)
        return [null, stream[0], null, null, null, final_url];
    }
    log_error(`Video not found for [${final_url}]`)
    return [null, null, null, null, null, null];
}
