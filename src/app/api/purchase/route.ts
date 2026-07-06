import { purchaseTrackInDb } from "@/lib/purchaseTrackDb";

export async function POST(req: Request) {
  const { trackName, artistName, price, approved } = await req.json();

  if (!approved) {
    return Response.json({ result: "Purchase cancelled." });
  }

  const result = await purchaseTrackInDb(trackName, artistName, price);
  return Response.json({ result });
}
