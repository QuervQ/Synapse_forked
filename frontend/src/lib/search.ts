const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CX = import.meta.env.VITE_GOOGLE_CX || '';
const BASE_URL = 'https://www.googleapis.com/customsearch/v1';
// types
import { supabase } from '../lib/supabase';
import type { Search_cache } from '../types/search_cache';

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    displayLink: string;
    htmlTitle?: string;
    htmlSnippet?: string;
    formattedUrl?: string;
}

export interface SearchResponse {
    items: SearchResult[];
    searchInformation: {
        totalResults: string;
        searchTime: number;
    };
    queries?: {
        nextPage?: Array<{ startIndex: number }>;
    };
}

export interface SearchParams {
    query: string;
    num?: number; // 取得件数（1-10）
    start?: number; // 開始位置（ページネーション用）
}

// cache作成

// キャッシュを保存
export async function postSearchCache(
    searchWord: string, 
    results: SearchResult[]
): Promise<void> {
    try {
        // 検索結果を個別にINSERT
        const cacheData = results.map(result => ({
            search_word: searchWord,
            title: result.title,
            url: result.link,
            detail: result.snippet
        }));

        const { error } = await supabase
            .from('search_results')
            .insert(cacheData);

        if (error) throw error;
    } catch (error) {
        console.error('キャッシュ保存エラー:', error);
        throw error;
    }
}

// キャッシュを取得
export async function getSearchCache(searchWord: string): Promise<Search_cache[] | null> {
    try {
        
        // 2時間以内のキャッシュのみ取得              時間  分  秒
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('search_results')
            .select('*')
            .eq('search_word', searchWord)
            .gte('created_at', twoHoursAgo)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('キャッシュ取得エラー:', error);
        return null;
    }
}

/**
 * Google Custom Search APIで検索を実行
 */
export async function searchGoogle(params: SearchParams): Promise<SearchResponse> {
    const { query, num = 10, start = 1 } = params;

    if (!query.trim()) {
        throw new Error('検索クエリが空です');
    }

    if (!API_KEY || !CX) {
        console.warn('API KEYまたはCXが設定されていません。.env.localを確認してください。');
        throw new Error('API KEYまたはCXが設定されていません');
    }

    const url = new URL(BASE_URL);
    url.searchParams.append('key', API_KEY);
    url.searchParams.append('cx', CX);
    url.searchParams.append('q', query);
    url.searchParams.append('num', num.toString());
    url.searchParams.append('start', start.toString());

    try {
        const cache_result = await getSearchCache(query);
        if (cache_result != null && cache_result.length > 0) {
            // キャッシュが存在する場合はSearchResponse型に整形して返す
            return {
                items: cache_result.map((c) => ({
                    title: c.title,
                    link: c.url,
                    snippet: c.detail,
                    displayLink: '', // 必要に応じて
                })),
                searchInformation: {
                    totalResults: cache_result.length.toString(),
                    searchTime: 0,
                },
            };
        }
        // cacheがない場合に通常の検索をできるようにする
        const response = await fetch(url.toString());

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '検索に失敗しました');
        }
        const data = await response.json();

        // APIから取得した検索結果をキャッシュに保存
        if (data.items && Array.isArray(data.items)) {
            // SearchResult[]型に変換
            const results: SearchResult[] = data.items.map((item: any) => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet,
                displayLink: item.displayLink || '',
                htmlTitle: item.htmlTitle,
                htmlSnippet: item.htmlSnippet,
                formattedUrl: item.formattedUrl,
            }));
            await postSearchCache(query, results);
        }

        return data;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('検索中にエラーが発生しました');
    }
}

/**
 * 次のページを取得するためのstartIndexを計算
 */
export function getNextPageStart(currentStart: number, resultsPerPage: number): number {
    return currentStart + resultsPerPage;
}

/**
 * 前のページを取得するためのstartIndexを計算
 */
export function getPrevPageStart(currentStart: number, resultsPerPage: number): number {
    return Math.max(1, currentStart - resultsPerPage);
}

