const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CX = import.meta.env.VITE_GOOGLE_CX || '';
const BASE_URL = 'https://www.googleapis.com/customsearch/v1';

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
        const response = await fetch(url.toString());

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '検索に失敗しました');
        }

        const data = await response.json();
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