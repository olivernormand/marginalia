"""In-memory LRU cache with TTL for API responses."""

from cachetools import TTLCache
from threading import Lock

# Cache configuration from README: 30 min TTL, ~500 entries
CACHE_TTL = 30 * 60  # 30 minutes in seconds
CACHE_MAX_SIZE = 500

# Separate caches for different data types
_search_cache: TTLCache[str, list] = TTLCache(maxsize=CACHE_MAX_SIZE, ttl=CACHE_TTL)
_feed_cache: TTLCache[str, dict] = TTLCache(maxsize=CACHE_MAX_SIZE, ttl=CACHE_TTL)
_lookup_cache: TTLCache[int, dict] = TTLCache(maxsize=CACHE_MAX_SIZE, ttl=CACHE_TTL)

# Locks for thread safety
_search_lock = Lock()
_feed_lock = Lock()
_lookup_lock = Lock()


def get_cached_search(query: str) -> list | None:
    """Get cached search results for a query."""
    with _search_lock:
        return _search_cache.get(query.lower())


def set_cached_search(query: str, results: list) -> None:
    """Cache search results for a query."""
    with _search_lock:
        _search_cache[query.lower()] = results


def get_cached_feed(url: str) -> dict | None:
    """Get cached feed data for a URL."""
    with _feed_lock:
        return _feed_cache.get(url)


def set_cached_feed(url: str, feed_data: dict) -> None:
    """Cache feed data for a URL."""
    with _feed_lock:
        _feed_cache[url] = feed_data


def get_cached_lookup(collection_id: int) -> dict | None:
    """Get cached lookup data for a collection ID."""
    with _lookup_lock:
        return _lookup_cache.get(collection_id)


def set_cached_lookup(collection_id: int, lookup_data: dict) -> None:
    """Cache lookup data for a collection ID."""
    with _lookup_lock:
        _lookup_cache[collection_id] = lookup_data


def get_cache_stats() -> dict:
    """Get cache statistics for debugging."""
    return {
        "search_cache": {
            "size": len(_search_cache),
            "max_size": _search_cache.maxsize,
            "ttl": _search_cache.ttl,
        },
        "feed_cache": {
            "size": len(_feed_cache),
            "max_size": _feed_cache.maxsize,
            "ttl": _feed_cache.ttl,
        },
        "lookup_cache": {
            "size": len(_lookup_cache),
            "max_size": _lookup_cache.maxsize,
            "ttl": _lookup_cache.ttl,
        },
    }
