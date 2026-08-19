import { Hono } from "hono";
import { query } from "../lib/sanity.js";
import { renderConsolePage } from "../templates/console.js";

const app = new Hono();

const ALL_DOSSIERS_QUERY = `*[_type == "dossier"] | order(_createdAt desc){
  _id, code, title, location, overview, heroImage, objectives
}`;

app.get("/", async (c) => {
  const dossiers = await query(c.env, ALL_DOSSIERS_QUERY);
  const html = renderConsolePage({ dossiers, gmEmail: c.get("gmEmail") });
  return c.html(html);
});

export default app;
