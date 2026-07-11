// A second, deliberately separate Route Handler - POST /api/purchase. Called
// directly by the PurchaseApproval component in src/app/page.tsx when a human
// clicks Approve/Reject. The model in api/chat/route.ts never calls this
// endpoint itself; it only ever proposes a purchase via the purchaseTrack
// tool (src/lib/tools/purchaseTrack.ts) and waits for a human decision.
import { purchaseTrackInDb } from "@/lib/purchaseTrackDb";

export async function POST(req: Request) {
  const { trackName, artistName, price, approved } = await req.json();

  // Rejection short-circuits before the database is touched at all.
  if (!approved) {
    return Response.json({ result: "Purchase cancelled." });
  }

  // Only reachable after explicit human approval - this is the one and only
  // code path in the entire app that writes an Invoice/InvoiceLine row
  // (see src/lib/purchaseTrackDb.ts for the actual insert + transaction).
  const result = await purchaseTrackInDb(trackName, artistName, price);
  return Response.json({ result });
}
