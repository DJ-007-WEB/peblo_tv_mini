import { FormEvent, useEffect, useState } from "react";
import {
  getToken,
  getCurrentUser,
  imageUrl,
  request,
  setToken,
  type Episode,
  type Report,
  type Run,
  type Season,
  type Show,
  type User,
} from "./api";

const sections = ["featured", "series", "minisodes", "songs"];
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

function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="button" {...props}>
      {children}
    </button>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const enter = (token: string) => {
    setToken(token);
    getCurrentUser()
      .then(onLogin)
      .catch(() =>
        setError(
          "The API is not running yet. Start the backend or Docker Compose.",
        ),
      );
  };
  return (
    <main className="login">
      <div className="login-card">
        <div className="mark">P</div>
        <p className="eyebrow">PEBLO TV / STUDIO</p>
        <h1>
          Make something
          <br />
          <em>wonderful.</em>
        </h1>
        <p className="muted">
          A calm little workspace for your next adventure.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) enter(value.trim());
          }}
        >
          <label>
            Access token
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste bearer token"
              type="password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <Button type="submit">
            Enter studio <span>→</span>
          </Button>
        </form>
        <div className="demo-access">
          <small>Local demo access</small>
          <div>
                   <button
              type="button"
              className="text-button"
              onClick={() => enter("peblo-editor-token")}
            >
              Editor token
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => enter("peblo-admin-token")}
            >
              Admin token
            </button>
          </div>
        </div>
        <small>Editors manage content. Admins can publish.</small>
      </div>
    </main>
  );
}

function ArtworkSlot({
  kind,
  episode,
  onUpload,
}: {
  kind: string;
  episode?: Episode;
  onUpload?: (kind: string, file: File) => Promise<void>;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  const specs: Record<string, string> = {
    poster: "600 × 900 px · 2:3",
    banner: "1280 × 720 px · 16:9",
    thumbnail: "640 × 360 px · 16:9",
  };
  const existing = episode?.artwork.find((a) => a.kind === kind)?.url;
  return (
    <label className="art-slot">
      <div className="art-head">
        <strong>{kind[0].toUpperCase() + kind.slice(1)}</strong>
        <small>{specs[kind]}</small>
      </div>
      <div className={`art-preview ${kind}`}>
        {preview || existing ? (
          <img src={preview || imageUrl(existing!)} />
             ) : (
          <span>＋</span>
        )}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png"
        disabled={!onUpload}
        onChange={async (e) => {
          const file = e.target.files?.[0];
           if (!file || !onUpload) return;
           setError("");
           if (file.size > 200 * 1024) { setError("This image is larger than 200 KB. Choose a smaller file."); return; }
           const required = { poster: [600, 900], banner: [1280, 720], thumbnail: [640, 360] }[kind] ?? [];
           const dimensions = await new Promise<[number, number] | null>((resolve) => { const image = new Image(); image.onload = () => resolve([image.width, image.height]); image.onerror = () => resolve(null); image.src = URL.createObjectURL(file); });
           if (!dimensions || dimensions[0] !== required[0] || dimensions[1] !== required[1]) { setError(`${kind} must be exactly ${required[0]} × ${required[1]} pixels.`); return; }
           setPreview(URL.createObjectURL(file));
          try {
            await onUpload(kind, file);
          } catch (err) {
            setError((err as Error).message);
            setPreview(undefined);
          }
        }}
      />
      <small className="upload-hint">
        {onUpload ? "Upload image · max 200 KB" : "Add an episode first"}
      </small>
      {error && <span className="error">{error}</span>}
    </label>
  );
}

function EpisodeManager({ showId }: { showId: number }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [season, setSeason] = useState<Season>();
  const [episode, setEpisode] = useState<Episode>();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("300");
  const [language, setLanguage] = useState("en");
  const [contentGroup, setContentGroup] = useState("");
  const [episodeStatus, setEpisodeStatus] = useState("draft");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [seasonTitle, setSeasonTitle] = useState("Main season");
  const [loading, setLoading] = useState(true);
  const loadSeason = async (item: Season, clearEpisode = true) => {
    setSeason(await request<Season>(`/admin/seasons/${item.id}`));
    if (clearEpisode) { setEpisode(undefined); setEpisodeNumber(String((item.episodes?.length ?? 0) + 1)); setContentGroup(`${showId}-s${item.number}-e${(item.episodes?.length ?? 0) + 1}`); }
  };
  const load = async () => {
    setLoading(true);
    try {
      const result = await request<{ items: Season[] }>(
        `/admin/shows/${showId}/seasons`,
      );
      setSeasons(result.items);
      if (result.items.length) await loadSeason(result.items[0]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [showId]);
  const createSeason = async () => {
    try {
      const created = await request<Season>(`/admin/shows/${showId}/seasons`, {
        method: "POST",
        body: JSON.stringify({
          number: Math.max(0, ...seasons.map((s) => s.number)) + 1,
          title: seasonTitle,
        }),
      });
      setSeasons([...seasons, created]);
      await loadSeason(created);
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const save = async () => {
    if (!season || !title.trim() || !episodeNumber || !contentGroup.trim()) return;
    try {
      const payload = { number: Number(episodeNumber), title: title.trim(), duration_seconds: duration ? Number(duration) : null, language, content_group: contentGroup.trim(), status: episodeStatus };
      const ep = await request<Episode>(episode ? `/admin/episodes/${episode.id}` : `/admin/seasons/${season.id}/episodes`, { method: episode ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setEpisode(ep);
      setTitle("");
      setEpisodeNumber(""); setContentGroup(""); setDuration("300"); setEpisodeStatus("draft"); setLanguage("en");
      await loadSeason(season, false);
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const editEpisode = (item: Episode) => {
    setEpisode(item); setTitle(item.title); setEpisodeNumber(String(item.number)); setDuration(item.duration_seconds ? String(item.duration_seconds) : ""); setLanguage(item.language); setContentGroup(item.content_group); setEpisodeStatus(item.status);
  };
  const upload = async (kind: string, file: File) => {
    if (!episode) return;
    const data = new FormData();
    data.append("file", file);
    await request(`/admin/episodes/${episode.id}/artwork/${kind}`, {
      method: "POST",
      body: data,
    });
    setEpisode(await request<Episode>(`/admin/episodes/${episode.id}`));
    await loadSeason(season!, false);
  };
  if (loading) return <div className="state">Loading episode lists…</div>;
  return (
    <div className="episodes">
      <div className="subhead">
        <div>
          <p className="eyebrow">EPISODES</p>
          <h3>
            {season ? `Season ${season.number}` : "Start the episode list"}
          </h3>
        </div>
        {season && (
          <span className="pill">{season.episodes?.length ?? 0} episodes</span>
        )}
      </div>
      {seasons.length > 0 && (
        <label>
          Season
          <select
            value={season?.id ?? ""}
            onChange={(e) => {
              const found = seasons.find(
                (s) => s.id === Number(e.target.value),
              );
              if (found) void loadSeason(found);
            }}
          >
           {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                Season {s.number}: {s.title || "Untitled"}
              </option>
           ))}
          </select>
          {season && <><button className="text-button" type="button" onClick={async () => { const next = prompt("Season title", season.title); if (next !== null) { await request(`/admin/seasons/${season.id}`, { method: "PATCH", body: JSON.stringify({ number: season.number, title: next }) }); await load(); } }}>Rename</button><button className="text-button danger" type="button" onClick={async () => { if (confirm("Delete this season and all its episodes?")) { await request(`/admin/seasons/${season.id}`, { method: "DELETE" }); await load(); } }}>Delete</button></>}
        </label>
      )}
      {!season && (
        <div className="quick-add">
          <input
            value={seasonTitle}
            onChange={(e) => setSeasonTitle(e.target.value)}
            placeholder="Season title"
          />
          <Button type="button" onClick={createSeason}>
            Create season
          </Button>
        </div>
      )}
      {season?.episodes?.map((e) => (
        <div className="episode-line" key={e.id}>
          <span className="episode-num">
            {String(e.number).padStart(2, "0")}
          </span>
          <div>
            <strong>{e.title}</strong>
            <small>
              {e.language.toUpperCase()} ·{" "}
              {e.duration_seconds
                ? `${Math.round(e.duration_seconds / 60)} min`
                : "No duration"}
            </small>
          </div>
          <span className={`status ${e.status}`}>{e.status}</span>
          <div className="line-actions"><button className="text-button" onClick={() => editEpisode(e)}>Edit</button><button className="text-button danger" onClick={async () => { if (confirm(`Delete ${e.title}?`)) { await request(`/admin/episodes/${e.id}`, { method: "DELETE" }); if (episode?.id === e.id) setEpisode(undefined); await loadSeason(season, false); } }}>Delete</button></div>
        </div>
      ))}
      {season && (
        <div className="quick-add">
          <input value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} placeholder="No." type="number" min="1" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={episode ? "Episode title" : "New episode title"} />
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (seconds)" type="number" min="1" />
          <select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="hi">Hindi</option></select>
          <input value={contentGroup} onChange={(e) => setContentGroup(e.target.value)} placeholder="Content group" />
          <select value={episodeStatus} onChange={(e) => setEpisodeStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select>
          <Button type="button" onClick={save} disabled={!title.trim() || !episodeNumber || !contentGroup.trim()}>
            {episode ? "Save episode" : "Add episode"}
          </Button>
          {episode && <button className="text-button" onClick={() => { setEpisode(undefined); setTitle(""); }}>New</button>}
        </div>
      )}
      {episode && (
        <div className="artwork-grid">
          {["poster", "banner", "thumbnail"].map((k) => (
            <ArtworkSlot key={k} kind={k} episode={episode} onUpload={upload} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShowEditor({
  show,
  onSaved,
  onCancel,
}: {
  show?: Show;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: show?.title ?? "",
    slug: show?.slug ?? "",
    synopsis: show?.synopsis ?? "",
    section: show?.section ?? "",
    status: show?.status ?? "draft",
    categories: show?.categories ?? ([] as string[]),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      synopsis: form.synopsis.trim(),
      section: form.section || null,
      status: form.status,
      categories: [...form.categories],
    };
    try {
      await request(`/admin/shows${show ? `/${show.id}` : ""}`, {
        method: show ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel editor">
      <div className="panel-title">
        <div>
          <p className="eyebrow">{show ? "EDIT SHOW" : "NEW SHOW"}</p>
          <h2>{show?.title ?? "Create a show"}</h2>
        </div>
        <button type="button" className="text-button" onClick={onCancel}>
          Close ×
        </button>
      </div>
      <form onSubmit={submit} className="form-grid">
        {error && <p className="wide error" role="alert">{error}</p>}
        <label>
          Show title
          <input
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. The Little Explorers"
          />
        </label>
        <label>
          Slug
          <input
            required
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            placeholder="little-explorers"
          />
        </label>
        <label className="wide">
          Synopsis
          <textarea
            value={form.synopsis}
            onChange={(e) => update("synopsis", e.target.value)}
            rows={3}
          />
        </label>
        <label>
          Section
          <select
            value={form.section}
            onChange={(e) => update("section", e.target.value)}
          >
            <option value="">Choose a section</option>
            {sections.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option>draft</option>
            <option>published</option>
          </select>
        </label>
        <div className="wide">
          <span className="field-label">Categories</span>
          <div className="chips">
            {categories.map((c) => (
                   <button
                type="button"
                className={
                  form.categories.includes(c) ? "chip selected" : "chip"
                }
                key={c}
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    categories: previous.categories.includes(c)
                      ? previous.categories.filter((x) => x !== c)
                      : [...previous.categories, c],
                  }))
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="wide editor-actions">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : show ? "Save changes" : "Create show"}
          </Button>
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
      {show && <EpisodeManager showId={show.id} />}
    </section>
  );
}

function Publish({
  report,
  runs,
  onPublished,
}: {
  report?: Report;
  runs: Run[];
  onPublished: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const issues = Object.values(report?.issues ?? {}).flat();
  const blocked = report?.blocking === true;
  return (
    <div className="publish-grid">
      <section className="panel release-card">
        <div className="release-icon">✦</div>
        <p className="eyebrow">CATALOGUE STATUS</p>
        <h2>
          {blocked ? "A few things need care" : "Your catalogue is ready"}
        </h2>
        <p className="muted">
          {blocked
            ? "Resolve these checks before your shows can go live."
            : "Everything looks good. Publishing makes the latest approved content visible to families."}
        </p>
        {blocked && (
          <div className="issues">
            {issues.map((x, i) => (
              <div className="issue" key={i}>
                <span>!</span>
                <div>
                  <strong>{x.message ?? "Content needs attention"}</strong>
                  <small>Check the show or episode details</small>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button
          disabled={blocked || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await request("/admin/catalog/publish", { method: "POST" });
              onPublished();
            } catch (e) {
              alert((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Publishing…" : "Publish catalogue →"}
        </Button>
      </section>
      <section className="panel history">
        <div className="panel-title">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h3>Release history</h3>
          </div>
          <span className="pill">{runs.length} runs</span>
        </div>
        {runs.length === 0 ? (
          <div className="state">No releases yet.</div>
        ) : (
          runs.map((r) => (
            <div className="run" key={r.id}>
              <span className={`run-dot ${r.outcome}`}></span>
              <div>
                <strong>Release #{r.id}</strong>
                <small>
                  {r.actor} · {new Date(r.started_at).toLocaleString()}
                </small>
              </div>
              <span
                className={r.outcome === "success" ? "success-text" : "error"}
              >
                {r.outcome}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Content({ onLogout, user }: { onLogout: () => void; user: User }) {
  const [tab, setTab] = useState<"shows" | "publish">("shows");
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Show | "new" | null>(null);
  const [report, setReport] = useState<Report>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const refresh = () => {
    setLoading(true);
    setError("");
      request<{ items: Show[]; total: number; pages: number }>(
      `/admin/shows?q=${encodeURIComponent(q)}&status=${status}&section=${section}&language=${language}&page=${page}&limit=12`,
    )
      .then((x) => { setShows(x.items); setTotal(x.total); setPages(x.pages); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
  }, [q, status, section, language, page]);
  useEffect(() => { setPage(1); }, [q, status, section, language]);
  useEffect(() => {
    if (tab === "publish" && user.role === "admin") {
      request<Report>("/admin/validation-report")
        .then(setReport)
        .catch((e) => setError((e as Error).message));
      request<{ items: Run[] }>("/admin/catalog/runs")
        .then((x) => setRuns(x.items))
        .catch(() => {});
    }
  }, [tab, user.role]);
  const visible = shows;
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <div className="mark small">P</div>
          <span>
            peblo <b>tv</b>
          </span>
        </div>
        <div className="workspace">
          <span className="avatar">E</span>
          <div>
            <strong>{user.role === "admin" ? "Catalogue admin" : "Editorial team"}</strong>
            <small>{user.role === "admin" ? "Publishing access" : "Content access"}</small>
          </div>
        </div>
        <nav>
          <button
            className={tab === "shows" ? "active" : ""}
            onClick={() => setTab("shows")}
          >
            ▦ <span>Shows</span>
          </button>
          {user.role === "admin" && <button
            className={tab === "publish" ? "active" : ""}
            onClick={() => setTab("publish")}
          >
            ◈ <span>Publish</span>
          </button>}
        </nav>
        <div className="aside-bottom">
          <small>PEBLO TV MINI</small>
          <button onClick={onLogout}>↪ Sign out</button>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <p className="eyebrow">
              {tab === "shows" ? `${user.role.toUpperCase()} CONTENT LIBRARY` : "ADMIN RELEASE DESK"}
            </p>
            <h1>{tab === "shows" ? "Your shows" : "Ready for launch?"}</h1>
          </div>
          {tab === "shows" && (
            <Button type="button" onClick={() => setEditing("new")}>＋ New show</Button>
          )}
        </header>
        {tab === "publish" ? (
          <Publish
            report={report}
            runs={runs}
            onPublished={() => setTab("shows")}
          />
        ) : editing !== null ? (
          <ShowEditor
            show={editing === "new" ? undefined : editing}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <div className="toolbar">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search shows…"
              />
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">All sections</option>
                {sections.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option>draft</option>
                <option>published</option>
              </select>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="">All languages</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            {error && <p className="error">{error}</p>}
            {loading ? (
              <div className="state">Loading shows…</div>
            ) : visible.length === 0 ? (
              <div className="state">
                No shows found. Start your next adventure with{" "}
                <button
                  className="text-button"
                  onClick={() => setEditing("new")}
                >
                  New show
                </button>
                .
              </div>
            ) : (
              <div className="show-grid">
                {visible.map((show) => (
                  <article className="show-card" key={show.id}>
                    <span className="show-art">{show.title[0]}</span>
                     <button className="show-name" onClick={() => setEditing(show)}>
                      <strong>{show.title}</strong>
                      <small>
                        {show.section ?? "Unassigned"} · {show.status}
                      </small>
                     </button>
                    <span className="card-actions"><button className="text-button" onClick={() => setEditing(show)}>Edit</button><button className="text-button danger" onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete ${show.title} and all its episodes?`)) { await request(`/admin/shows/${show.id}`, { method: "DELETE" }); refresh(); } }}>Delete</button></span>
                    </article>
                ))}
              </div>
            )}
            {total > 0 && <div className="pagination"><span>Showing {(page - 1) * 12 + 1}-{Math.min(page * 12, total)} of {total}</span><div><button className="text-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="text-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
          </>
        )}
      </main>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<User>();
  const [token, setLocalToken] = useState(getToken());
  useEffect(() => {
    if (token) getCurrentUser().then(setUser).catch(() => { setToken(""); setLocalToken(""); });
  }, [token]);
  return token && user ? (
    <Content
      user={user}
      onLogout={() => {
        localStorage.removeItem("peblo-token");
        setToken("");
        setLocalToken("");
      }}
    />
  ) : (
    <Login onLogin={(nextUser) => { setUser(nextUser); setLocalToken(getToken()); }} />
  );
}
