"use client";

import { useState, useCallback } from "react";
import {
  Shield, Users, Newspaper, Swords, Loader2, AlertCircle,
  TrendingUp, RefreshCw, Search, Radio, Layers, Target,
  ArrowRightLeft, Sparkles, Info, Trophy, UserSearch, Flame
} from "lucide-react";

const SLEEPER = "https://api.sleeper.app/v1";
const FANTASY_POS = ["QB", "RB", "WR", "TE", "K", "DEF"];

const POS_COLOR = { QB: "#6C8FE0", RB: "#4FAE74", WR: "#E0B94D", TE: "#D2694F", K: "#9C9C86", DEF: "#9A7FD4" };
const posColor = (p) => POS_COLOR[p] || "#8B8B7A";

const theme = {
  bg: "#132019", bgGrid: "#0F1A14", card: "#1B2E22", cardAlt: "#20362A",
  line: "rgba(237,233,222,0.10)", lineStrong: "rgba(237,233,222,0.22)",
  chalk: "#EDE9DE", chalkDim: "#B9C2B6", gold: "#D4A94A", danger: "#D2694F",
};

async function sGet(path) {
  const res = await fetch(`${SLEEPER}${path}`);
  if (!res.ok) throw new Error(`Sleeper request failed (${res.status}): ${path}`);
  return res.json();
}

function slotList(rosterPositions) {
  return (rosterPositions || []).filter((p) => p !== "BN");
}

function buildRosterBreakdown(league, roster) {
  const startSlots = slotList(league.roster_positions);
  const starterIds = roster.starters || [];
  const starters = starterIds.map((pid, i) => ({ slot: startSlots[i] || "FLEX", pid }));
  const ir = roster.reserve || [];
  const taxi = roster.taxi || [];
  const allIds = roster.players || [];
  const bench = allIds.filter((pid) => !starterIds.includes(pid) && !ir.includes(pid) && !taxi.includes(pid));
  return { starters, bench, ir, taxi };
}

function resolvePlayer(pid, playersMap) {
  if (!pid) return { full_name: "Empty", position: "", team: "" };
  const p = playersMap[pid];
  if (!p) return { full_name: pid, position: "", team: "" };
  return {
    full_name: p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || pid,
    position: p.position || "",
    team: p.team || "FA",
    injury_status: p.injury_status || null,
  };
}

function scoringBadges(league) {
  const s = league.scoring_settings || {};
  const rp = league.roster_positions || [];
  const qbSlots = rp.filter((p) => p === "QB").length;
  const isSF = qbSlots > 1 || rp.includes("SUPER_FLEX");
  const ppr = s.rec || 0;
  const tePrem = s.bonus_rec_te || 0;
  const badges = [];
  badges.push(ppr >= 1 ? "Full PPR" : ppr > 0 ? `${ppr} PPR` : "Standard");
  if (isSF) badges.push("Superflex");
  if (tePrem > 0) badges.push(`TE Premium +${tePrem}`);
  if (rp.includes("TAXI") || league.settings?.taxi_slots > 0) badges.push("Taxi Squad");
  return badges;
}

function computeFreeAgents(rosters, playersMap, trendingIds, limit = 150) {
  const rostered = new Set();
  (rosters || []).forEach((r) => (r.players || []).forEach((pid) => rostered.add(pid)));
  return Object.values(playersMap || {})
    .filter((p) => p && FANTASY_POS.includes(p.position) && !rostered.has(p.player_id) && p.active !== false)
    .map((p) => ({
      pid: p.player_id,
      full_name: p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      position: p.position,
      team: p.team || "FA",
      search_rank: p.search_rank ?? 999999,
      trending: trendingIds.has(p.player_id),
    }))
    .sort((a, b) => a.search_rank - b.search_rank)
    .slice(0, limit);
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callScoutApi(prompt) {
  const res = await fetch("/api/scout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Scouting report failed.");
  return data.text;
}

function Badge({ children, tone = "default" }) {
  const styles = {
    default: { background: "rgba(237,233,222,0.08)", color: theme.chalk, border: `1px solid ${theme.line}` },
    gold: { background: "rgba(212,169,74,0.14)", color: theme.gold, border: "1px solid rgba(212,169,74,0.35)" },
    danger: { background: "rgba(210,105,79,0.14)", color: theme.danger, border: "1px solid rgba(210,105,79,0.35)" },
    green: { background: "rgba(79,169,116,0.14)", color: "#4FAE74", border: "1px solid rgba(79,169,116,0.35)" },
  };
  return (
    <span style={{ ...styles[tone], fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.04em", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      {Icon && <Icon size={15} color={theme.gold} />}
      <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.chalkDim }}>
        {children}
      </span>
    </div>
  );
}

function PlayerRow({ slot, player }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: `1px solid ${theme.line}` }}>
      {slot && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: theme.chalkDim, width: 46, flexShrink: 0 }}>{slot}</div>}
      <div style={{ width: 6, height: 30, borderRadius: 3, flexShrink: 0, background: posColor(player.position) }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: theme.chalk, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.full_name}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: theme.chalkDim }}>{player.position} · {player.team}</div>
      </div>
      {player.injury_status && <Badge tone="danger">{player.injury_status}</Badge>}
      {player.trending && <Badge tone="green"><Flame size={10} style={{ display: "inline", verticalAlign: -1 }} /> Hot</Badge>}
    </div>
  );
}

function DepthChart({ league, roster, playersMap }) {
  if (!roster) return null;
  const { starters, bench, ir, taxi } = buildRosterBreakdown(league, roster);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <SectionLabel icon={Shield}>Starting Lineup</SectionLabel>
        <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
          {starters.map((s, i) => <PlayerRow key={i} slot={s.slot} player={resolvePlayer(s.pid, playersMap)} />)}
        </div>
      </div>
      <div>
        <SectionLabel icon={Users}>Bench</SectionLabel>
        <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
          {bench.length === 0 && <div style={{ padding: 12, color: theme.chalkDim, fontSize: 13 }}>No bench players.</div>}
          {bench.map((pid, i) => <PlayerRow key={i} player={resolvePlayer(pid, playersMap)} />)}
        </div>
      </div>
      {taxi.length > 0 && (
        <div>
          <SectionLabel icon={Layers}>Taxi Squad</SectionLabel>
          <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
            {taxi.map((pid, i) => <PlayerRow key={i} player={resolvePlayer(pid, playersMap)} />)}
          </div>
        </div>
      )}
      {ir.length > 0 && (
        <div>
          <SectionLabel icon={AlertCircle}>Injured Reserve</SectionLabel>
          <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
            {ir.map((pid, i) => <PlayerRow key={i} player={resolvePlayer(pid, playersMap)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function TradedPicks({ picks, rosterId, rosterIdToTeam }) {
  const involving = (picks || []).filter((p) => p.owner_id === rosterId || p.previous_owner_id === rosterId || p.roster_id === rosterId);
  const acquired = involving.filter((p) => p.owner_id === rosterId && p.roster_id !== rosterId);
  const traded = involving.filter((p) => p.previous_owner_id === rosterId && p.owner_id !== rosterId);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <SectionLabel icon={ArrowRightLeft}>Draft Picks Acquired</SectionLabel>
        <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}`, padding: acquired.length ? 0 : 12 }}>
          {acquired.length === 0 && <div style={{ color: theme.chalkDim, fontSize: 13 }}>No picks acquired via trade — just your own draft slots.</div>}
          {acquired.map((p, i) => (
            <div key={i} style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.line}`, fontSize: 13, color: theme.chalk }}>
              {p.season} Round {p.round} <span style={{ color: theme.chalkDim }}>— originally {rosterIdToTeam[p.roster_id] || `Team ${p.roster_id}`}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel icon={ArrowRightLeft}>Draft Picks Traded Away</SectionLabel>
        <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}`, padding: traded.length ? 0 : 12 }}>
          {traded.length === 0 && <div style={{ color: theme.chalkDim, fontSize: 13 }}>None of your original picks have been traded away.</div>}
          {traded.map((p, i) => (
            <div key={i} style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.line}`, fontSize: 13, color: theme.chalk }}>
              {p.season} Round {p.round} <span style={{ color: theme.chalkDim }}>— now with {rosterIdToTeam[p.owner_id] || `Team ${p.owner_id}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Standings({ rosters, users, myUserId, onSelectTeam }) {
  const rows = [...rosters]
    .sort((a, b) => (b.settings?.wins || 0) - (a.settings?.wins || 0) || (b.settings?.fpts || 0) - (a.settings?.fpts || 0))
    .map((r) => {
      const u = users.find((u) => u.user_id === r.owner_id);
      return {
        rosterId: r.roster_id,
        name: u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`,
        record: `${r.settings?.wins ?? 0}-${r.settings?.losses ?? 0}${r.settings?.ties ? `-${r.settings.ties}` : ""}`,
        points: r.settings?.fpts ?? 0,
        mine: r.owner_id === myUserId,
      };
    });
  return (
    <div>
      <SectionLabel icon={Trophy}>Standings</SectionLabel>
      <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
        {rows.map((t, i) => (
          <button
            key={i}
            onClick={() => !t.mine && onSelectTeam(t.rosterId)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              borderBottom: `1px solid ${theme.line}`, background: t.mine ? "rgba(212,169,74,0.08)" : "transparent",
              border: "none", cursor: t.mine ? "default" : "pointer", textAlign: "left",
            }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: theme.gold, width: 20 }}>{i + 1}</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: theme.chalk }}>
              {t.name}{t.mine && <span style={{ color: theme.gold }}> (You)</span>}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: theme.chalkDim }}>{t.record}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: theme.chalkDim, width: 80, textAlign: "right" }}>{t.points.toLocaleString()} pts</div>
          </button>
        ))}
      </div>
      <div style={{ color: theme.chalkDim, fontSize: 12, marginTop: 8 }}>Tap any team to browse their roster.</div>
    </div>
  );
}

function TeamBrowser({ league, rosters, users, rosterId, playersMap, onBack }) {
  const roster = rosters.find((r) => r.roster_id === rosterId);
  const u = users.find((u) => u.user_id === roster?.owner_id);
  const name = u?.metadata?.team_name || u?.display_name || `Team ${rosterId}`;
  return (
    <div>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: theme.gold, fontSize: 12, marginBottom: 14, cursor: "pointer", padding: 0 }}>
        ← Back to Standings
      </button>
      <SectionLabel icon={UserSearch}>{name}</SectionLabel>
      <DepthChart league={league} roster={roster} playersMap={playersMap} />
    </div>
  );
}

function FreeAgents({ freeAgents }) {
  const [posFilter, setPosFilter] = useState("ALL");
  const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];
  const filtered = (posFilter === "ALL" ? freeAgents : freeAgents.filter((p) => p.position === posFilter)).slice(0, 60);
  return (
    <div>
      <SectionLabel icon={UserSearch}>Free Agents</SectionLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {positions.map((p) => (
          <button
            key={p}
            onClick={() => setPosFilter(p)}
            style={{
              padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${posFilter === p ? theme.gold : theme.line}`,
              background: posFilter === p ? "rgba(212,169,74,0.12)" : "transparent",
              color: posFilter === p ? theme.gold : theme.chalkDim,
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
        {filtered.length === 0 && <div style={{ padding: 12, color: theme.chalkDim, fontSize: 13 }}>No free agents match this filter.</div>}
        {filtered.map((p, i) => <PlayerRow key={i} player={p} />)}
      </div>
    </div>
  );
}

function AIWarRoom({ league, myRoster, myTeamName, rosters, users, playersMap, freeAgents, nflState, cache, setCache }) {
  const key = league.league_id;
  const state = cache[key] || { loading: false, error: null, data: null };

  const run = useCallback(async () => {
    setCache((prev) => ({ ...prev, [key]: { loading: true, error: null, data: prev[key]?.data || null } }));
    try {
      const { starters, bench, taxi } = buildRosterBreakdown(league, myRoster);
      const nameOf = (pid) => {
        const p = resolvePlayer(pid, playersMap);
        return `${p.full_name} (${p.position}, ${p.team}${p.injury_status ? `, ${p.injury_status}` : ""})`;
      };
      const starterList = starters.map((s) => `${s.slot}: ${nameOf(s.pid)}`).join("; ");
      const benchList = bench.map(nameOf).join("; ");
      const taxiList = taxi.map(nameOf).join("; ");
      const badges = scoringBadges(league).join(", ");
      const phase = nflState.season_type;
      const week = nflState.week;

      const otherTeamsList = rosters
        .filter((r) => r.roster_id !== myRoster.roster_id)
        .map((r) => {
          const u = users.find((u) => u.user_id === r.owner_id);
          const teamName = u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`;
          const record = `${r.settings?.wins ?? 0}-${r.settings?.losses ?? 0}`;
          const names = (r.players || []).map((pid) => {
            const p = resolvePlayer(pid, playersMap);
            return `${p.full_name} (${p.position})`;
          }).join(", ");
          return `${teamName} (${record}): ${names}`;
        }).join("\n");

      const faList = freeAgents.slice(0, 40).map((p) => `${p.full_name} (${p.position}, ${p.team})`).join("; ");

      const prompt = `You are a dynasty fantasy football analyst with live web search. Research current NFL news, injury reports, expert rankings, and trending waiver activity, then give sharp, concrete advice for this specific team using full knowledge of the whole league.

League: "${league.name}", format: ${badges}.
Season phase: ${phase} (week ${week}, ${nflState.season} season).

MY TEAM ("${myTeamName}"):
Starters: ${starterList || "none set"}.
Bench: ${benchList || "none"}.
${taxiList ? `Taxi squad: ${taxiList}.` : ""}

OTHER TEAMS IN THIS LEAGUE (use these exact team and player names for trade proposals):
${otherTeamsList}

FREE AGENTS CURRENTLY AVAILABLE (use these exact names for waiver targets — do not suggest a player who is already on a roster above):
${faList}

Search for the latest injury news, depth chart changes, and rankings relevant to these specific players before answering.

Respond with ONLY a raw JSON object (no markdown fences, no preamble) matching exactly this shape:
{
  "summary": "1-2 sentence outlook for this team right now",
  "start_sit": [{"start": "player name", "sit": "player name", "why": "short reason"}],
  "waiver_targets": [{"player": "name from the free agent list above", "why": "short reason"}],
  "trade_proposals": [{"with_team": "exact other team name from above", "give": ["my player(s)"], "get": ["their player(s)"], "why": "short reason this helps both sides"}],
  "draft_targets": [{"player": "name", "why": "short reason"}],
  "news": [{"headline": "short headline", "detail": "1 sentence detail"}]
}
Rules: if it is off-season or preseason with no live matchups, return an empty array for start_sit and focus more on trade_proposals and draft_targets (rookie/dynasty draft prep). Trade proposals MUST use real team names and real player names from the rosters listed above, and should target realistic positional needs. Keep every array to at most 4 items. Keep "why"/"detail" under 20 words each.`;

      const text = await callScoutApi(prompt);
      const json = extractJson(text);
      setCache((prev) => ({ ...prev, [key]: { loading: false, error: null, data: json } }));
    } catch (e) {
      setCache((prev) => ({ ...prev, [key]: { loading: false, error: e.message || "Something went wrong", data: prev[key]?.data || null } }));
    }
  }, [league, myRoster, myTeamName, rosters, users, playersMap, freeAgents, nflState, key, setCache]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color={theme.gold} />
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.chalk }}>AI Scouting Report</span>
        </div>
        <button onClick={run} disabled={state.loading} style={{ display: "flex", alignItems: "center", gap: 8, background: theme.gold, color: "#1B2E22", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: state.loading ? "default" : "pointer", opacity: state.loading ? 0.7 : 1 }}>
          {state.loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          {state.loading ? "Researching…" : state.data ? "Refresh Report" : "Run Scouting Report"}
        </button>
      </div>

      {!state.data && !state.loading && !state.error && (
        <div style={{ color: theme.chalkDim, fontSize: 13 }}>
          Pulls live news, injury updates, and rankings for your exact roster, plus every other team's roster and the free agent pool — then recommends start/sit calls, waiver targets, specific trade proposals naming real league-mates, and draft targets.
        </div>
      )}

      {state.error && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: theme.danger, fontSize: 13, marginBottom: 12 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{state.error}</span>
        </div>
      )}

      {state.data && (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: theme.cardAlt, border: `1px solid ${theme.lineStrong}`, borderRadius: 10, padding: 14, fontSize: 14, color: theme.chalk, fontStyle: "italic" }}>
            {state.data.summary}
          </div>

          {state.data.start_sit?.length > 0 && (
            <div>
              <SectionLabel icon={Swords}>Start / Sit</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {state.data.start_sit.map((r, i) => (
                  <div key={i} style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}`, padding: 12 }}>
                    <div style={{ fontSize: 13, color: theme.chalk }}>
                      <span style={{ color: "#4FAE74", fontWeight: 600 }}>Start {r.start}</span> over <span style={{ color: theme.danger, fontWeight: 600 }}>{r.sit}</span>
                    </div>
                    <div style={{ color: theme.chalkDim, fontSize: 12, marginTop: 4 }}>{r.why}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.data.waiver_targets?.length > 0 && (
            <div>
              <SectionLabel icon={Target}>Waiver Targets</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {state.data.waiver_targets.map((r, i) => (
                  <div key={i} style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}`, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: theme.chalk }}>{r.player}</div>
                    <div style={{ color: theme.chalkDim, fontSize: 12, marginTop: 4 }}>{r.why}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.data.trade_proposals?.length > 0 && (
            <div>
              <SectionLabel icon={ArrowRightLeft}>Targeted Trade Proposals</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {state.data.trade_proposals.map((r, i) => (
                  <div key={i} style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}`, padding: 12 }}>
                    <div style={{ fontSize: 12, color: theme.gold, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      With {r.with_team}
                    </div>
                    <div style={{ fontSize: 13, color: theme.chalk }}>
                      <span style={{ color: theme.danger, fontWeight: 600 }}>You give:</span> {(r.give || []).join(", ")}
                    </div>
                    <div style={{ fontSize: 13, color: theme.chalk, marginTop: 2 }}>
                      <span style={{ color: "#4FAE74", fontWeight: 600 }}>You get:</span> {(r.get || []).join(", ")}
                    </div>
                    <div style={{ color: theme.chalkDim, fontSize: 12, marginTop: 6 }}>{r.why}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.data.draft_targets?.length > 0 && (
            <div>
              <SectionLabel icon={Layers}>Draft Targets</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {state.data.draft_targets.map((r, i) => (
                  <div key={i} style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}`, padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: theme.chalk }}>{r.player}</div>
                    <div style={{ color: theme.chalkDim, fontSize: 12, marginTop: 4 }}>{r.why}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.data.news?.length > 0 && (
            <div>
              <SectionLabel icon={Newspaper}>News Notes</SectionLabel>
              <div style={{ display: "grid", gap: 8 }}>
                {state.data.news.map((r, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${theme.line}` }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: theme.chalk }}>{r.headline}</div>
                    <div style={{ color: theme.chalkDim, fontSize: 12, marginTop: 2 }}>{r.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendingBoard({ trendingAdds, playersMap }) {
  return (
    <div>
      <SectionLabel icon={TrendingUp}>Trending Adds — Last 48 Hours (League-Wide)</SectionLabel>
      <div style={{ background: theme.cardAlt, borderRadius: 10, border: `1px solid ${theme.line}` }}>
        {trendingAdds.length === 0 && <div style={{ padding: 12, color: theme.chalkDim, fontSize: 13 }}>No trending data available right now.</div>}
        {trendingAdds.map((t, i) => {
          const p = resolvePlayer(t.player_id, playersMap);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderBottom: `1px solid ${theme.line}` }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: theme.gold, width: 24 }}>{i + 1}</div>
              <div style={{ width: 6, height: 26, borderRadius: 3, background: posColor(p.position) }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: theme.chalk }}>{p.full_name}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: theme.chalkDim }}>{p.position} · {p.team}</div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: theme.chalkDim }}>{t.count?.toLocaleString?.() || t.count} adds</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Page() {
  const [username, setUsername] = useState("");
  const [phase, setPhase] = useState("idle");
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState(null);

  const [sleeperUser, setSleeperUser] = useState(null);
  const [nflState, setNflState] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [playersMap, setPlayersMap] = useState(null);
  const [trendingAdds, setTrendingAdds] = useState([]);

  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [selectedTab, setSelectedTab] = useState("depth");
  const [browsingRosterId, setBrowsingRosterId] = useState(null);
  const [aiCache, setAiCache] = useState({});

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setLeagues([]);
    setSelectedLeagueId(null);
    try {
      setLoadMsg("Looking up Sleeper account…");
      const user = await sGet(`/user/${encodeURIComponent(username.trim())}`);
      if (!user || !user.user_id) throw new Error(`No Sleeper account found for "${username}".`);
      setSleeperUser(user);

      setLoadMsg("Checking NFL season state…");
      const state = await sGet(`/state/nfl`);
      setNflState(state);

      setLoadMsg("Finding your dynasty leagues…");
      let leagueList = await sGet(`/user/${user.user_id}/leagues/nfl/${state.season}`);
      if (!leagueList || leagueList.length === 0) {
        leagueList = await sGet(`/user/${user.user_id}/leagues/nfl/${Number(state.season) - 1}`);
      }
      if (!leagueList || leagueList.length === 0) throw new Error("No leagues found for this account.");

      setLoadMsg(`Loading rosters for ${leagueList.length} league${leagueList.length > 1 ? "s" : ""}…`);
      const detailed = await Promise.all(leagueList.map(async (lg) => {
        const [rosters, lgUsers, tradedPicks] = await Promise.all([
          sGet(`/league/${lg.league_id}/rosters`),
          sGet(`/league/${lg.league_id}/users`),
          sGet(`/league/${lg.league_id}/traded_picks`).catch(() => []),
        ]);
        let matchups = null;
        if ((state.season_type === "regular" || state.season_type === "post") && state.week) {
          matchups = await sGet(`/league/${lg.league_id}/matchups/${state.week}`).catch(() => null);
        }
        return { league: lg, rosters, users: lgUsers, tradedPicks, matchups };
      }));

      setLoadMsg("Loading player database (once per session)…");
      const players = await sGet(`/players/nfl`);
      setPlayersMap(players);

      setLoadMsg("Checking league-wide waiver trends…");
      const trending = await sGet(`/players/nfl/trending/add?lookback_hours=48&limit=25`).catch(() => []);
      setTrendingAdds(trending);

      setLeagues(detailed);
      setSelectedLeagueId(detailed[0]?.league.league_id || null);
      setPhase("ready");
    } catch (e) {
      setError(e.message || "Something went wrong loading your leagues.");
      setPhase("error");
    }
  }, [username]);

  const selected = leagues.find((l) => l.league.league_id === selectedLeagueId);
  const myRoster = selected ? selected.rosters.find((r) => r.owner_id === sleeperUser?.user_id) : null;
  const rosterIdToTeam = selected
    ? Object.fromEntries(selected.rosters.map((r) => {
        const u = selected.users.find((u) => u.user_id === r.owner_id);
        return [r.roster_id, u?.metadata?.team_name || u?.display_name || `Team ${r.roster_id}`];
      }))
    : {};
  const myUser = selected ? selected.users.find((u) => u.user_id === sleeperUser?.user_id) : null;
  const standing = selected
    ? [...selected.rosters]
        .sort((a, b) => (b.settings?.wins || 0) - (a.settings?.wins || 0) || (b.settings?.fpts || 0) - (a.settings?.fpts || 0))
        .findIndex((r) => r.owner_id === sleeperUser?.user_id) + 1
    : null;

  const trendingIds = new Set((trendingAdds || []).map((t) => t.player_id));
  const freeAgents = selected && playersMap ? computeFreeAgents(selected.rosters, playersMap, trendingIds) : [];

  const tabs = [
    { id: "depth", label: "My Team", icon: Shield },
    { id: "standings", label: "Standings", icon: Trophy },
    { id: "picks", label: "Trades & Picks", icon: ArrowRightLeft },
    { id: "fa", label: "Free Agents", icon: UserSearch },
    { id: "ai", label: "AI War Room", icon: Sparkles },
    { id: "trends", label: "League Trends", icon: TrendingUp },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg,
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, ${theme.bgGrid} 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, ${theme.bgGrid} 40px)`,
      color: theme.chalk, padding: "28px 20px 60px",
    }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: 34, letterSpacing: "0.02em", margin: 0, color: theme.chalk, textTransform: "uppercase" }}>
          Dynasty Command Center
        </h1>
        <div style={{ color: theme.chalkDim, fontSize: 13, marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
          Live Sleeper data + AI scouting, one roster at a time.
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap", alignItems: "center", background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 12, padding: 14 }}>
          <Search size={16} color={theme.chalkDim} />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            placeholder="Enter your Sleeper username"
            style={{ flex: 1, minWidth: 160, background: "transparent", border: "none", color: theme.chalk, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}
          />
          <button
            onClick={load}
            disabled={phase === "loading" || !username.trim()}
            style={{ display: "flex", alignItems: "center", gap: 8, background: theme.gold, color: "#1B2E22", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: phase === "loading" ? "default" : "pointer", opacity: phase === "loading" ? 0.7 : 1 }}
          >
            {phase === "loading" ? <Loader2 size={14} className="spin" /> : <Radio size={14} />}
            {phase === "loading" ? "Loading…" : "Load Leagues"}
          </button>
        </div>

        {phase === "loading" && <div style={{ color: theme.chalkDim, fontSize: 13, marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>{loadMsg}</div>}

        {phase === "error" && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: theme.danger, fontSize: 14, marginBottom: 20 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {phase === "ready" && sleeperUser && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              {sleeperUser.avatar && (
                <img src={`https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}`} alt="" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.line}` }} />
              )}
              <div style={{ fontSize: 14, color: theme.chalk }}>{sleeperUser.display_name}</div>
              <Badge>{nflState.season} · {nflState.season_type === "regular" ? `Week ${nflState.week}` : nflState.season_type.toUpperCase() + "-SEASON"}</Badge>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {leagues.map(({ league }) => (
                <button
                  key={league.league_id}
                  onClick={() => { setSelectedLeagueId(league.league_id); setSelectedTab("depth"); setBrowsingRosterId(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999,
                    border: `1px solid ${league.league_id === selectedLeagueId ? theme.gold : theme.line}`,
                    background: league.league_id === selectedLeagueId ? "rgba(212,169,74,0.12)" : theme.card,
                    color: league.league_id === selectedLeagueId ? theme.gold : theme.chalk,
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  <Shield size={13} />
                  {league.name}
                </button>
              ))}
            </div>

            {selected && myRoster && (
              <>
                <div style={{ background: theme.card, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 600, color: theme.chalk, textTransform: "uppercase" }}>
                        {myUser?.metadata?.team_name || myUser?.display_name || "My Team"}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: theme.chalkDim, marginTop: 4 }}>
                        {myRoster.settings?.wins ?? 0}-{myRoster.settings?.losses ?? 0}{myRoster.settings?.ties ? `-${myRoster.settings.ties}` : ""}
                        {"  ·  "}Standing #{standing} of {selected.rosters.length}
                        {"  ·  "}{(myRoster.settings?.fpts ?? 0).toLocaleString()} pts
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                      {scoringBadges(selected.league).map((b, i) => <Badge key={i} tone="gold">{b}</Badge>)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: `1px solid ${theme.line}`, flexWrap: "wrap" }}>
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTab(t.id); if (t.id !== "standings") setBrowsingRosterId(null); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "transparent",
                        border: "none", borderBottom: `2px solid ${selectedTab === t.id ? theme.gold : "transparent"}`,
                        color: selectedTab === t.id ? theme.chalk : theme.chalkDim, fontWeight: 600, fontSize: 13, cursor: "pointer",
                      }}
                    >
                      <t.icon size={14} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {selectedTab === "depth" && <DepthChart league={selected.league} roster={myRoster} playersMap={playersMap} />}
                {selectedTab === "standings" && !browsingRosterId && (
                  <Standings rosters={selected.rosters} users={selected.users} myUserId={sleeperUser.user_id} onSelectTeam={setBrowsingRosterId} />
                )}
                {selectedTab === "standings" && browsingRosterId && (
                  <TeamBrowser
                    league={selected.league}
                    rosters={selected.rosters}
                    users={selected.users}
                    rosterId={browsingRosterId}
                    playersMap={playersMap}
                    onBack={() => setBrowsingRosterId(null)}
                  />
                )}
                {selectedTab === "picks" && <TradedPicks picks={selected.tradedPicks} rosterId={myRoster.roster_id} rosterIdToTeam={rosterIdToTeam} />}
                {selectedTab === "fa" && <FreeAgents freeAgents={freeAgents} />}
                {selectedTab === "ai" && (
                  <AIWarRoom
                    league={selected.league}
                    myRoster={myRoster}
                    myTeamName={myUser?.metadata?.team_name || myUser?.display_name || "My Team"}
                    rosters={selected.rosters}
                    users={selected.users}
                    playersMap={playersMap}
                    freeAgents={freeAgents}
                    nflState={nflState}
                    cache={aiCache}
                    setCache={setAiCache}
                  />
                )}
                {selectedTab === "trends" && <TrendingBoard trendingAdds={trendingAdds} playersMap={playersMap} />}
              </>
            )}

            {selected && !myRoster && <div style={{ color: theme.chalkDim, fontSize: 13 }}>Couldn't find your roster in this league.</div>}
          </>
        )}

        {phase === "idle" && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: theme.chalkDim, fontSize: 13 }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Enter a Sleeper username above and load your leagues. Roster data comes straight from Sleeper's public API — nothing is stored on this site.</span>
          </div>
        )}
      </div>
    </div>
  );
}
