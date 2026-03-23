from workers import Response, WorkerEntrypoint
from urllib.parse import urlparse, parse_qs, unquote
from submodule import get_title_from_url, get_search_result, get_video_from_id
from datetime import datetime
import sys

def log_error(message):
    timestamp = datetime.now().strftime('[%d/%b/%Y %H:%M:%S]')
    sys.stderr.write(f"\033[31m{timestamp} \"ERROR: {message}\"\033[0m\n")

def log_info(message):
    timestamp = datetime.now().strftime('[%d/%b/%Y %H:%M:%S]')
    print(f"{timestamp} \"INFO: {message}\"", flush=True)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        parsed = urlparse(request.url)
        if parsed.path == "/api/search":
            if request.method == "OPTIONS":
                return Response(None, status=204, headers=CORS_HEADERS)
            
            parsed = urlparse(request.url)
            params = parse_qs(parsed.query)
            raw_q = params.get("q", [None])[0]
            if raw_q:
                target_q = unquote(raw_q)
            else:
                target_q = None
            start = int(params.get("start", [0])[0] or 0)
            limit = 5
            end = start + limit

            if not target_q:
                return Response.json(
                    {"status": "error", "message": "Missing 'q' parameter"},
                    status=400,
                    headers=CORS_HEADERS
                )
            
            try:
                results = await get_search_result(target_q, start, end)
                if results:
                    return Response.json({
                        "status": "success",
                        "results": results
                    }, headers=CORS_HEADERS)
                else:
                    return Response.json(
                        {"status": "error", "message": "Unable to fetch M3U stream"},
                        status=500,
                        headers=CORS_HEADERS
                    )
            except Exception as e:
                return Response.json(
                    {"status": "error", "message": str(e)},
                    status=500,
                    headers=CORS_HEADERS
                )

        elif parsed.path == "/api/stream":
            if request.method == "OPTIONS":
                return Response(None, status=204, headers=CORS_HEADERS)
            
            parsed = urlparse(request.url)
            params = parse_qs(parsed.query)
            video_id = params.get("id", [None])[0]
            video_url, _, _ = await get_video_from_id(video_id)

            if video_url:
                log_info(f"M3U Stream found for [{video_id}], Stream=[{video_url}]")
                return Response.json({
                    "status": "success",
                    "stream": video_url,
                }, headers=CORS_HEADERS)
            
            log_error(f"M3U Stream not found for [{video_id}]")
            return Response.json(
                {"status": "error", "message": "M3U stream not found"},
                status=404,
                headers=CORS_HEADERS
                )

        elif parsed.path == "/api/parse":
            if request.method == "OPTIONS":
                return Response(None, status=204, headers=CORS_HEADERS)

            parsed = urlparse(request.url)
            params = parse_qs(parsed.query)
            target_url = params.get("url", [None])[0]
            start = int(params.get("start", [0])[0] or 0)
            limit = 5
            end = start + limit

            if not target_url:
                return Response.json(
                    {"status": "error", "message": "Missing 'url' parameter"},
                    status=400,
                    headers=CORS_HEADERS
                )

            try:
                title, video_url, video_thumbnail, video_id, subheading, target_url = await get_title_from_url(target_url, start, end)

                if video_url:
                    return Response.json({
                        "status": "success",
                        "title": title,
                        "subheading": subheading,
                        "stream": video_url,
                        "thumbnail": video_thumbnail
                    }, headers=CORS_HEADERS)
                else:
                    return Response.json(
                        {"status": "error", "message": "Unable to fetch M3U stream"},
                        status=500,
                        headers=CORS_HEADERS
                    )

            except Exception as e:
                return Response.json(
                    {"status": "error", "message": str(e)},
                    status=500,
                    headers=CORS_HEADERS
                )
        else:
            return Response.json({
                "status": "error",
                "message": "Endpoint not found",
            }, status=404, headers=CORS_HEADERS)