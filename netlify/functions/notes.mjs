import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Scoped store for studio community notes
  const store = getStore("studio_notes");
  const KEY = "pinned_notes";

  const starterNotes = [
    {
      id: "note-welcome",
      text: "Welcome to my motion design studio! Feel free to leave a quick hello or feedback on this board. ✨",
      author: "Arindam Banerjee",
      mood: "⚡ Quick Hello",
      color: "yellow",
      rotation: -1.5,
      createdAt: 1730980000000
    }
  ];

  if (req.method === "GET") {
    try {
      let notes = await store.get(KEY, { type: "json" });
      if (!notes || !Array.isArray(notes)) {
        notes = starterNotes;
        await store.setJSON(KEY, notes);
      }
      return new Response(JSON.stringify(notes), {
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-cache, no-store, must-revalidate"
        },
        status: 200
      });
    } catch (err) {
      console.error("Blobs read error:", err);
      return new Response(JSON.stringify(starterNotes), {
        headers: corsHeaders,
        status: 200
      });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!body || !body.text || !body.text.trim()) {
        return new Response(JSON.stringify({ error: "Message text is required" }), {
          headers: corsHeaders,
          status: 400
        });
      }

      let notes = [];
      try {
        const existing = await store.get(KEY, { type: "json" });
        if (Array.isArray(existing)) {
          notes = existing;
        } else {
          notes = starterNotes;
        }
      } catch (e) {
        notes = starterNotes;
      }

      const authorClean = body.author && typeof body.author === "string" ? body.author.trim().slice(0, 40) : "";
      const moodClean = body.mood && typeof body.mood === "string" ? body.mood.trim().slice(0, 40) : "⚡ Quick Hello";
      const colorClean = ["yellow", "mint", "peach", "dark"].includes(body.color) ? body.color : "yellow";
      const rotClean = typeof body.rotation === "number" ? Math.max(-5, Math.min(5, body.rotation)) : 0;

      const newNote = {
        id: "note-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        text: String(body.text).trim().slice(0, 280),
        author: authorClean,
        mood: moodClean,
        color: colorClean,
        rotation: rotClean,
        createdAt: Date.now()
      };

      notes.unshift(newNote);
      if (notes.length > 40) notes = notes.slice(0, 40);

      await store.setJSON(KEY, notes);

      return new Response(JSON.stringify({ success: true, note: newNote, notes }), {
        headers: corsHeaders,
        status: 201
      });
    } catch (err) {
      console.error("Blobs write error:", err);
      return new Response(JSON.stringify({ error: "Failed to pin note" }), {
        headers: corsHeaders,
        status: 500
      });
    }
  }

  return new Response("Method Not Allowed", { headers: corsHeaders, status: 405 });
};

export const config = {
  path: "/api/notes"
};
