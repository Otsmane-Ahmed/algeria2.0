/**
 * POST /api/documents/:id/extraction/confirm (arch.md §8, Documents table).
 *
 * The handler lives in ../route.ts next to the GET it shares `ownedExtraction`
 * with; this segment exists so the path matches the spec. Without it the review
 * panel's confirm POST fell through to Next's 404 and the student saw a bare
 * "error" after typing their details.
 */
export { POST } from "../route";
