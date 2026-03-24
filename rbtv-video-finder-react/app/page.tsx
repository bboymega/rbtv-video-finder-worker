"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCircleNotch, 
  faExclamationTriangle,
  faPlay,
  faSearch,
  faLink,
  faCheck,
  faArrowUp,
  faArrowUpRightFromSquare
} from '@fortawesome/free-solid-svg-icons';

const searchCache: Record<string, VideoResult[]> = {};

interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  subheading?: string;
  year?: string;
  priority: number;
  page_url: string;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [error, setError] = useState<null | string>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setError(null);
    setProgress(2);
    setVisibleCount(10);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);

    if (searchCache[searchTerm]) {
      setResults(searchCache[searchTerm]);
      setProgress(100);
      setTimeout(() => setProgress(0), 400);
      return;
    }

    const offsets = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    const totalParts = offsets.length;
    let resolvedCount = 0;
    let currentResultsMap = new Map<string, VideoResult>();

    setIsSearching(true);
    setResults([]);

    const lowQuery = searchTerm.toLowerCase();

    const fetchPart = async (offset: number, index: number) => {
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, index * 100);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('Aborted'));
          });
        });

        const res = await fetch(`${siteUrl}/api/search?q=${encodeURIComponent(searchTerm)}&start=${offset}`, { signal });
        if (!res.ok) return;

        const data = await res.json();
        if (signal.aborted) return;

        if (data.status === "success" && data.results) {
          data.results.forEach((item: VideoResult) => {
            const existing = currentResultsMap.get(item.id);
            if (!existing || item.priority < existing.priority) {
              currentResultsMap.set(item.id, item);
            }
          });
          
          const getStem = (word: string): string => {
            const cleanWord = word.toLowerCase().trim();

            return cleanWord.replace(
              /(?:[aeiouy]ing|ed|es|s|er|ment|ando|endo|ar|ir|or|ez|amente|amente|zioni|tion|cion)$/i,
              ''
            );
          };

          const getLevDistance = (a: string, b: string): number => {
            const an = a.length;
            const bn = b.length;
            if (an === 0) return bn;
            if (bn === 0) return an;

            const matrix: number[][] = Array.from({ length: an + 1 }, (_, i) => 
              Array.from({ length: bn + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
            );

            for (let i = 1; i <= an; i++) {
              for (let j = 1; j <= bn; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                  matrix[i - 1][j] + 1,
                  matrix[i][j - 1] + 1,
                  matrix[i - 1][j - 1] + cost
                );
              }
            }
            return matrix[an][bn];
          };

          const sorted = Array.from(currentResultsMap.values()).sort((a: VideoResult, b: VideoResult) => {
            const getScore = (v: VideoResult): number => {
            const title = (v.title || "").toLowerCase();
            const sub = (v.subheading || "").toLowerCase();
            const queryWords = lowQuery.trim().split(/\s+/).filter(Boolean);
            
            if (queryWords.length === 0) return 0;

            let totalScore = 0;

            queryWords.forEach((qWord) => {
              const qStem = getStem(qWord);
              
              const getBestMatchInField = (textField: string): number => {
                const words = textField.split(/\s+/);
                let bestFieldScore = 0;

                words.forEach((tWord) => {
                  const tLower = tWord.toLowerCase().replace(/[^a-z0-9]/g, "");
                  const tStem = getStem(tLower);
                  let currentWordScore = 0;

                  if (tLower === qWord) {
                    currentWordScore = 100;
                  } else if (tStem === qStem && qStem.length > 2) {
                    currentWordScore = 80;
                  } else if (qWord.length > 3) {
                    const distance = getLevDistance(qWord, tLower);
                    if (distance === 1) currentWordScore = 40; 
                    else if (distance === 2 && qWord.length > 5) currentWordScore = 15;
                  }
                  
                  bestFieldScore = Math.max(bestFieldScore, currentWordScore);
                });
                return bestFieldScore;
              };

              const titleScore = getBestMatchInField(title);
              const subScore = getBestMatchInField(sub);

              const wordMaxScore = Math.max(titleScore * 1.2, subScore);
              
              totalScore += wordMaxScore;
            });

            return totalScore;
          };

            const scoreA = getScore(a);
            const scoreB = getScore(b);

            if (scoreA !== scoreB) {
              return scoreB - scoreA;
            }

            if (a.priority !== b.priority) {
              return (a.priority ?? 3) - (b.priority ?? 3);
            }

            const yearA = parseInt(a.year || "0", 10);
            const yearB = parseInt(b.year || "0", 10);
            return yearB - yearA;
          });

          setResults([...sorted]);
        }
      } catch (e: unknown) {
        const error = e as Error;
        if (error.name === 'AbortError') {
          return;
        }
        console.warn(`Part ${offset} failed:`, error);
      } finally {
        if (!signal.aborted) {
          resolvedCount++;
          setProgress(Math.round((resolvedCount / totalParts) * 100));
        }
      }
    };

    try {
      await Promise.allSettled(offsets.map((offset, idx) => fetchPart(offset, idx)));

      if (!signal.aborted) {
        if (currentResultsMap.size > 0) {
          searchCache[searchTerm] = Array.from(currentResultsMap.values());
        } else {
          setError("No results found.");
        }
      }
    } catch (err: unknown) {
      if (signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error("Task failed:", err);
      setError("An unexpected error occurred.");
    } finally {
      if (!signal.aborted) {
        setIsSearching(false);
        setTimeout(() => setProgress(0), 800);
      }
    }
  }, [siteUrl]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) {
      const timer = setTimeout(() => searchRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      const trimmed = q.trim();
      setQuery(trimmed);
      performSearch(trimmed);
    } else {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setResults([]);
      setQuery('');
      setProgress(0);
      setIsSearching(false);
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [searchParams, performSearch]);

  const handleSearchSubmit = (e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    if (searchParams.get('q') === trimmedQuery) {
      delete searchCache[trimmedQuery]; 
      performSearch(trimmedQuery);
    } else {
      router.push(`?q=${encodeURIComponent(trimmedQuery)}`);
    }
  };

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && results.length > visibleCount) {
      setVisibleCount((prev) => prev + 15);
    }
  }, [results.length, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { 
      rootMargin: '300px',
      threshold: 0.1 
    });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    const handleScroll = () => setShowTopBtn(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGetLink = async (id: string) => {
    setFetchingId(id);
    try {
      const res = await fetch(`${siteUrl}/api/stream?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.status === "success" && data.stream) {
        await navigator.clipboard.writeText(data.stream);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      setError("Error retrieving stream URL.");
    } finally {
      setFetchingId(null);
    }
  };

  return (
    <div className="container-fluid min-vh-100 bg-light py-5">
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, pointerEvents: 'none' }}>
        <div style={{ 
          width: `${progress}%`, 
          height: '100%', 
          backgroundColor: '#000', 
          transition: 'width 0.3s ease-out, opacity 0.5s ease',
          opacity: progress > 0 && progress < 100 ? 1 : 0
        }} />
      </div>

      {showTopBtn && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
          className="btn btn-dark shadow-lg position-fixed d-flex align-items-center justify-content-center" 
          style={{ bottom: '30px', right: '30px', width: '50px', height: '50px', borderRadius: '50%', zIndex: 1000 }}
        >
          <FontAwesomeIcon icon={faArrowUp} />
        </button>
      )}

      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-8">
          <div className="text-center mb-5">
            <h1 
                className="display-5 fw-bold text-dark" 
                style={{ cursor: 'pointer' }} 
                onClick={() => {
                  if (abortControllerRef.current) abortControllerRef.current.abort();
                  
                  setQuery('');
                  setResults([]);
                  setError(null);
                  setProgress(0);

                  router.push('/?q=');
                }}
              >
                RBTV Video Finder
              </h1>
            <p className="text-muted">Find your favorite adrenaline-filled clips</p>
          </div>

          <div className="card shadow-sm border-0 p-3 p-md-4 mb-4">
            <form onSubmit={handleSearchSubmit}>
              <div className="input-group">
                <input
                  type="text"
                  ref={searchRef}
                  className="form-control form-control-lg border-primary-subtle shadow-none"
                  placeholder="Enter keywords..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isSearching}
                  required
                />
                <button className="btn btn-dark d-flex align-items-center justify-content-center" type="submit" disabled={isSearching} style={{ width: '48px' }}>
                  {isSearching ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faSearch} />}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <div className="alert alert-danger border-0 shadow-sm mb-4 d-flex align-items-center justify-content-between">
              <div><FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />{error}</div>
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}

          <div className="d-flex flex-column gap-3 mb-5">
            {results.slice(0, visibleCount).map((video) => (
              <div key={video.id} className="card shadow-sm border-0 overflow-hidden">
                <div className="card-body d-flex align-items-center p-3">
                  <div className="rounded me-3 bg-dark overflow-hidden" style={{ width: '80px', height: '80px', flexShrink: 0 }}>
                    <img src={video.thumbnail} alt="Thumbnail" className="w-100 h-100 shadow-sm" style={{ objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-grow-1 overflow-hidden">
                    <h6 className="text-truncate mb-1">{video.title}</h6>
                    <div className="small text-muted mb-2 text-truncate">{video.subheading || video.year}</div>
                    <div className="d-flex gap-2">
                      <a
                        className="btn btn-sm btn-outline-success"
                        href={video.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="me-1" />
                        Open Page
                      </a>
                      <button 
                        className={`btn btn-sm ${copiedId === video.id ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleGetLink(video.id)}
                        disabled={fetchingId === video.id}
                      >
                        <FontAwesomeIcon icon={fetchingId === video.id ? faCircleNotch : (copiedId === video.id ? faCheck : faLink)} spin={fetchingId === video.id} className="me-1" />
                        Copy M3U
                      </button>
                      <a
                        href={`/redirect?id=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-dark"
                      >
                        <FontAwesomeIcon icon={faPlay} className="me-1" /> Watch Clip
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div ref={observerTarget} style={{ height: '40px' }} className="d-flex justify-content-center align-items-center mt-3">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VideoSearch() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}