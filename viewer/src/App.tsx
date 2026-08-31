import { useEffect, useState } from "react";
import {
  getCatalog,
  imageUrl,
  searchCatalog,
  type Catalog,
  type Episode,
  type Show,
} from "./api";
const categories = [
  "adventure",
  "folk",
  "friendship",
  "india",
  "language",
  "learning",
  "maths",
  "music",
  "nature",
  "reading",
  "science",
  "singalong",
  "stories",
  "travel",
  "values",
];
function Placeholder({ wide = false }: { wide?: boolean }) {
  return <div className={`placeholder ${wide ? "wide-placeholder" : ""}`} />;
}
function Art({
  url,
  alt,
  wide = false,
}: {
  url?: string;
  alt: string;
  wide?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`art ${wide ? "wide-art" : ""}`}>
      {!loaded && <Placeholder wide={wide} />}
      {(!url || failed) && <div className="art-fallback"><span>✦</span><strong>Peblo TV</strong><small>{alt || "A little story"}</small></div>}
      {url && !failed && (
        <img
          src={imageUrl(url)}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); setLoaded(true); }}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
}
function Card({ show, onOpen }: { show: Show; onOpen: (show: Show) => void }) {
  const art = show.seasons
    .flatMap((s) => s.episodes)
    .find((e) => e.artwork.poster)?.artwork.poster;
  return (
    <button className="card" onClick={() => onOpen(show)} aria-label={`Open ${show.title}`}>
      <Art url={art} alt={show.title} />
      <span className="card-title">{show.title}</span>
      <small className="card-meta">{show.section || "Peblo stories"}</small>
      <small className="card-tags">{show.categories.slice(0, 2).join("  ·  ")}</small>
    </button>
  );
}
function showArtwork(show: Show, kind: string) {
  return show.seasons.filter((s) => s.number !== 0).flatMap((s) => s.episodes).find((e) => e.artwork[kind])?.artwork[kind];
}
function ShowDetail({ show, onBack }: { show: Show; onBack: () => void }) {
  const seasons = show.seasons.filter((s) => s.number !== 0);
  const first = seasons[0];
  const hero = first?.episodes[0];
  return (
    <main className="detail">
      <button className="back" onClick={onBack}>
        ← Back to browse
      </button>
      <div className="detail-top">
        <div className="detail-copy">
          <p className="kicker">{show.section || "PEBLO TV"}  ·  {show.categories.slice(0, 3).join("  ·  ")}</p>
          <h1>{show.title}</h1>
          <p>{show.synopsis || "A new adventure is waiting."}</p>
          <div className="detail-meta">
            <span>✦ {seasons.length} {seasons.length === 1 ? "season" : "seasons"}</span>
            <span>◉ {seasons.reduce((total, season) => total + season.episodes.length, 0)} episodes</span>
            <span>◎ All ages</span>
          </div>
        </div>
        {hero && (
          <Art
            wide
            url={hero.artwork.banner || hero.artwork.thumbnail}
            alt=""
          />
        )}
      </div>
      <div className="detail-content">
        <h2>Episodes</h2>
        {seasons.length === 0 ? (
          <p className="empty">Episodes are on their way.</p>
        ) : (
          seasons.map((season) => (
            <section className="season" key={season.number}>
              <h3>
                Season {season.number} <small>{season.title}</small>
              </h3>
              <div className="episode-grid">
                {season.episodes.map((ep, i) => (
                  <EpisodeCard key={`${ep.title}-${i}`} episode={ep} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
function EpisodeCard({ episode }: { episode: Episode }) {
  return (
    <article className="episode-card">
      <Art url={episode.artwork.thumbnail} alt={episode.title} />
      <div className="episode-info">
        <span className="episode-no">
          EP {String(episode.episode_number).padStart(2, "0")}
        </span>
        <h4>{episode.title}</h4>
        <p>
          {episode.duration_seconds
            ? `${Math.floor(episode.duration_seconds / 60)} min`
            : "Short story"}
        </p>
        <div className="languages">
          {episode.languages.map((l) => (
            <span key={l}>{l === "en" ? "English" : l === "hi" ? "हिन्दी" : l}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [selected, setSelected] = useState<Show>();
  const [results, setResults] = useState<Show[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    getCatalog()
      .then((data) => { setCatalog(data); const slug = new URLSearchParams(location.hash.replace(/^#/, "")).get("show"); if (slug) setSelected(data.sections.flatMap((section) => section.shows).find((show) => show.slug === slug)); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!q && !category && !language) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => { setSearching(true); searchCatalog(q, category, language, controller.signal).then(setResults).catch((e) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => setSearching(false)); }, 260);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, category, language]);
  if (selected)
    return (
      <>
        <Header q={q} setQ={setQ} menu={menu} setMenu={setMenu} />
         <ShowDetail show={selected} onBack={() => { history.pushState({}, "", "/"); setSelected(undefined); }} />
      </>
    );
  const sections = results
    ? [{ name: "Search results", shows: results }]
    : (catalog?.sections ?? []);
  return (
    <>
      <Header q={q} setQ={setQ} menu={menu} setMenu={setMenu} />
      {error ? (
        <div className="full-state">
          <h2>We hit a little bump</h2>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      ) : !catalog ? (
        <div className="loading-home">
          <Placeholder wide />
          <Placeholder />
          <Placeholder />
        </div>
      ) : (
        <main>
           <section className="hero">
             {(() => { const featured = catalog.sections.find((s) => s.name === "featured")?.shows[0] ?? catalog.sections[0]?.shows[0]; return featured ? <><Art wide url={showArtwork(featured, "banner") || showArtwork(featured, "thumbnail")} alt="" /><div className="hero-copy"><p className="kicker">PEBLO TV  ·  {featured.section || "NEW STORIES"}</p><h1>{featured.title}</h1><p>{featured.synopsis || "Stories made for curious minds and the grown-ups who watch with them."}</p><button onClick={() => setSelected(featured)}>View show <span>→</span></button></div></> : <div className="hero-copy"><p className="kicker">PEBLO TV</p><h1>Big little adventures</h1><p>Stories made for curious minds and the grown-ups who watch with them.</p></div>; })()}
           </section>
           <section className="filters" id="browse" aria-label="Catalogue filters">
            <div className="filter-search">
              ⌕
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What do you want to explore?"
              />
            </div>
             <select aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Every category</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
             <select aria-label="Filter by language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="">All languages</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
             </select>
             {(q || category || language) && <button className="clear-filters" onClick={() => { setQ(""); setCategory(""); setLanguage(""); }}>Clear</button>}
             {searching && <span className="search-status" aria-live="polite">Searching…</span>}
          </section>
          <div className="rows" id="new">
            {sections.map((section) => (
              <section className="row" key={section.name}>
                <div className="row-title">
                  <h2>{section.name}</h2>
                  <span>{section.shows.length} {section.shows.length === 1 ? "show" : "shows"} <b>→</b></span>
                </div>
                <div className="cards">
                  {section.shows.map((s) => (
                     <Card key={s.slug} show={s} onOpen={(show) => { history.pushState({}, "", `#show=${show.slug}`); setSelected(show); }} />
                  ))}
                </div>
              </section>
            ))}
            {sections.every((s) => !s.shows.length) && (
              <div className="full-state">
                <h2>Nothing here yet</h2>
                <p>Try a different adventure, category, or language.</p>
              </div>
            )}
          </div>
        </main>
      )}
    </>
  );
}
function Header({
  q,
  setQ,
  menu,
  setMenu,
}: {
  q: string;
  setQ: (x: string) => void;
  menu: boolean;
  setMenu: (x: boolean) => void;
}) {
  return (
    <header className="site-header">
      <a className="logo" href="/">
        peblo<span>tv</span>
      </a>
      <nav className={menu ? "open" : ""}>
        <a href="#browse" onClick={() => setMenu(false)}>Browse</a>
        <a href="#new" onClick={() => setMenu(false)}>New this week</a>
      </nav>
      <div className="header-search">
        ⌕
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
        />
      </div>
      <button className="menu" onClick={() => setMenu(!menu)}>
        ☰
      </button>
      <div className="profile">P</div>
    </header>
  );
}
export { App };
