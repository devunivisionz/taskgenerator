import React, { useEffect, useMemo, useRef, useState } from "react";


/**
 * Local-Only Task Generator with Webhook (React, Single File)
 * - Data persistence: localStorage only
 * - Single text input ("Context")
 * - AI-like task generation (deterministic, no network calls)
 * - 3–5 tasks, each with: name, description, timeframe
 * - Task management: display, complete, edit, persist to localStorage
 * - Webhook: POST on completion with developer-defined payload
 * - Simple success/failure notifications, no retry logic
 *
 * To use:
 * 1) Drop this file into a React app (e.g., src/App.jsx) and run your dev server.
 * 2) (Optional) Enter a webhook URL (e.g., from https://webhook.site or https://beeceptor.com) in the settings.
 */

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const LS_KEYS = {
  TASKS: "taskgen.tasks.v1",
  WEBHOOK_URL: "taskgen.webhookUrl.v1",
};

const DEFAULT_TIMEFRAMES = [
  "15 minutes",
  "30 minutes",
  "1 hour",
  "2 hours",
  "Half day",
  "1 day",
  "2–3 days",
];

function pickTimeframe(idx = 0) {
  return DEFAULT_TIMEFRAMES[idx % DEFAULT_TIMEFRAMES.length];
}

function smartCap(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferDomain(context) {
  const lc = context.toLowerCase();
  if (/(exam|study|college|test|syllabus)/.test(lc)) return "exam";
  if (/(move|relocat|apartment|pack|shifting)/.test(lc)) return "moving";
  if (/(pc|build.*computer|gaming.*rig|components|parts)/.test(lc)) return "pc";
  if (/(travel|trip|itinerary|flight|hotel)/.test(lc)) return "travel";
  if (/(fitness|workout|diet|health|gym)/.test(lc)) return "fitness";
  return "generic";
}

function generateTasks(context) {
  const domain = inferDomain(context || "");
  const base = [
    { key: "research", name: "Research essentials" },
    { key: "plan", name: "Draft a plan" },
    { key: "resources", name: "List resources & tools" },
    { key: "execute", name: "Execute first milestone" },
    { key: "review", name: "Review & next steps" },
  ];

  const domainHints = {
    exam: {
      research: "Outline subjects and weightage from the syllabus.",
      plan: "Create a 2-week timetable with daily topics.",
      resources: "Gather notes, past papers, and flashcards.",
      execute: "Study the first topic and attempt 10 practice questions.",
      review: "Revise mistakes and adjust timetable.",
    },
    moving: {
      research: "List must-have vs. discard items.",
      plan: "Create packing schedule and room-wise checklist.",
      resources: "Arrange boxes, labels, and transport.",
      execute: "Pack non-essentials and label boxes.",
      review: "Confirm mover timings; update address where needed.",
    },
    pc: {
      research: "Pick target use-case, budget, and performance goals.",
      plan: "Draft parts list (CPU, GPU, RAM, SSD, PSU, case).",
      resources: "Compare prices; ensure component compatibility.",
      execute: "Order parts or assemble mock build in a PCPartPicker clone.",
      review: "Cable-manage, run benchmarks, and validate thermals.",
    },
    travel: {
      research: "Choose destination, season, and budget.",
      plan: "Sketch a 3–5 day itinerary with must-see spots.",
      resources: "Check visas, flights, accommodation, and insurance.",
      execute: "Book flights/hotels and set calendar reminders.",
      review: "Share itinerary and offline maps to your phone.",
    },
    fitness: {
      research: "Define goals (strength, fat-loss, endurance).",
      plan: "Schedule 3–4 weekly sessions with progressive overload.",
      resources: "Set up gear, nutrition plan, and tracker app.",
      execute: "Complete first workout and log metrics.",
      review: "Assess soreness, sleep, and adjust plan.",
    },
    generic: {
      research: "Clarify objectives and success criteria.",
      plan: "Break work into 3–5 milestones.",
      resources: "List tools, people, or budget needed.",
      execute: "Complete first milestone with a small deliverable.",
      review: "Retrospect and plan the next block.",
    },
  }[domain];

  const tasks = base.map((b, i) => ({
    id: uid(),
    name: b.name,
    description: domainHints[b.key],
    timeframe: pickTimeframe(i + (domain === "generic" ? 1 : 0)),
    completed: false,
  }));

  // If context includes numbers like "3 tasks", cap at that, between 3–5
  const match = (context || "").match(/(\d+)\s*task/);
  let desired = match ? Math.min(5, Math.max(3, parseInt(match[1], 10))) : tasks.length;
  return tasks.slice(0, desired);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_KEYS.TASKS);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Failed to parse tasks from LS", e);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.warn("Failed to save tasks to LS", e);
  }
}

function loadWebhookUrl() {
  return localStorage.getItem(LS_KEYS.WEBHOOK_URL) || "";
}

function saveWebhookUrl(url) {
  localStorage.setItem(LS_KEYS.WEBHOOK_URL, url || "");
}

function Notice({ type = "info", message, onClose }) {
  const bg = type === "success" ? "#e6ffed" : type === "error" ? "#ffe6e6" : "#eef2ff";
  const color = type === "success" ? "#0f5132" : type === "error" ? "#842029" : "#1e3a8a";
  return (
    <div style={{
      background: bg,
      color,
      padding: "10px 12px",
      borderRadius: 10,
      border: `1px solid ${type === "success" ? "#badbcc" : type === "error" ? "#f5c2c7" : "#c7d2fe"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{
        border: "none", background: "transparent", cursor: "pointer", fontWeight: 700,
      }}>×</button>
    </div>
  );
}

export default function App() {
  const [context, setContext] = useState("");
  const [tasks, setTasks] = useState(() => loadTasks());
  const [webhookUrl, setWebhookUrl] = useState(() => loadWebhookUrl());
  const [notice, setNotice] = useState(null);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveWebhookUrl(webhookUrl), [webhookUrl]);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", description: "", timeframe: "" });

  function startEdit(task) {
    setEditingId(task.id);
    setEditDraft({ name: task.name, description: task.description, timeframe: task.timeframe });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ name: "", description: "", timeframe: "" });
  }

  function saveEdit(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...editDraft } : t)));
    cancelEdit();
  }

  function addGenerated() {
    if (!context.trim()) {
      setNotice({ type: "error", message: "Please enter some context first." });
      return;
    }
    const generated = generateTasks(context.trim());
    setTasks(generated);
    setNotice({ type: "success", message: `Generated ${generated.length} task(s).` });
  }

  function toggleComplete(task) {
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));

    if (!task.completed) {
      // Only fire webhook when marking as complete
      if (!webhookUrl) {
        setNotice({ type: "error", message: "No webhook URL set. Open Settings to add one." });
        return;
      }
      const payload = {
        event: "task_completed",
        timestamp: new Date().toISOString(),
        source: "taskgen-local-app",
        version: 1,
        task: {
          id: task.id,
          name: task.name,
          description: task.description,
          timeframe: task.timeframe,
          completed: true,
        },
        context,
      };
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const ok = res.ok;
          let bodyText = "";
          try { bodyText = await res.text(); } catch {}
          setNotice({
            type: ok ? "success" : "error",
            message: ok ? "Webhook sent successfully." : `Webhook failed: ${res.status} ${res.statusText}`,
          });
          if (!ok && bodyText) console.warn("Webhook error body:", bodyText);
        })
        .catch((err) => {
          console.error("Webhook error:", err);
          setNotice({ type: "error", message: `Webhook error: ${err?.message || "Network error"}` });
        });
    }
  }

  function addTask() {
    setTasks((prev) => [
      ...prev,
      {
        id: uid(),
        name: "New Task",
        description: "Describe the task...",
        timeframe: pickTimeframe(prev.length),
        completed: false,
      },
    ]);
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  return (
    <div style={{
      maxWidth: 860,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Task Generator</h1>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Settings</summary>
          <div style={{ padding: "10px 0", maxWidth: 520 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Webhook URL</label>
            <input
              placeholder="https://your-webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              Tip: Use <u>webhook.site</u> or <u>beeceptor.com</u> to test POSTs.
            </p>
          </div>
        </details>
      </header>

      {notice && (
        <div style={{ margin: "14px 0" }}>
          <Notice type={notice.type} message={notice.message} onClose={() => setNotice(null)} />
        </div>
      )}

      <section style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
      }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Context</label>
        <input
          placeholder='e.g., "How can I prepare for exam" or "I am preparing to move out"'
          value={context}
          onChange={(e) => setContext(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={addGenerated} style={btnPrimary}>Generate Tasks</button>
          <button onClick={addTask} style={btnGhost}>Add Blank Task</button>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Tasks</h2>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{completedCount}/{tasks.length} completed</span>
        </div>

        {tasks.length === 0 ? (
          <p style={{ color: "#6b7280", marginTop: 10 }}>No tasks yet. Enter context and click “Generate Tasks”.</p>) : null}

        <ul style={{ listStyle: "none", padding: 0, marginTop: 10, display: "grid", gap: 12 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 14,
              background: t.completed ? "#f0fdf4" : "#fff",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleComplete(t)}
                  title="Mark complete"
                  style={{ width: 18, height: 18, marginTop: 4 }}
                />
                <div style={{ flex: 1 }}>
                  {editingId === t.id ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 700 }}
                      />
                      <textarea
                        value={editDraft.description}
                        onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        rows={3}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      />
                      <input
                        value={editDraft.timeframe}
                        onChange={(e) => setEditDraft((d) => ({ ...d, timeframe: e.target.value }))}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", fontFamily: "monospace" }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => saveEdit(t.id)} style={btnPrimary}>Save</button>
                        <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, textDecoration: t.completed ? "line-through" : "none" }}>{t.name}</h3>
                        <span style={{ fontSize: 12, fontFamily: "monospace", background: "#f3f4f6", padding: "2px 8px", borderRadius: 999 }}>{t.timeframe}</span>
                      </div>
                      <p style={{ margin: 0, color: "#374151" }}>{t.description}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={() => startEdit(t)} style={btnGhost}>Edit</button>
                        <button onClick={() => deleteTask(t.id)} style={btnDanger}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer style={{ marginTop: 24, fontSize: 12, color: "#6b7280" }}>
        <p>Data is stored locally in your browser. Clearing site data will remove your tasks.</p>
      </footer>
    </div>
  );
}

const btnBase = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 700,
};

const btnPrimary = {
  ...btnBase,
  background: "#111827",
  color: "white",
};

const btnGhost = {
  ...btnBase,
  background: "white",
  border: "1px solid #e5e7eb",
};

const btnDanger = {
  ...btnBase,
  background: "#fee2e2",
  border: "1px solid #fecaca",
};
