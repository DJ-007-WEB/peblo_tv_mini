export const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'
export type Episode = { episode_number: number; title: string; duration_seconds: number | null; languages: string[]; artwork: Record<string,string> }
export type Season = { number: number; title: string; episodes: Episode[] }
export type Show = { slug: string; title: string; synopsis: string; categories: string[]; seasons: Season[]; section?: string }
export type Catalog = { sections: { name: string; shows: Show[] }[] }
export const imageUrl=(url?:string)=>url?(url.startsWith('http')?url:`${API}${url}`):''
export async function getCatalog():Promise<Catalog>{const r=await fetch(`${API}/catalog`);if(!r.ok)throw new Error('Catalogue unavailable');return r.json()}
export async function searchCatalog(query:string, category:string, language:string, signal?:AbortSignal):Promise<Show[]>{const params=new URLSearchParams({q:query});if(category)params.set('category',category);if(language)params.set('language',language);const r=await fetch(`${API}/catalog/search?${params}`,{signal});if(!r.ok)throw new Error('Search unavailable');return (await r.json()).items}
