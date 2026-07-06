import { db } from "./db";
import { DEMO_CUSTOMER_ID } from "./config";

export async function purchaseTrackInDb(
  trackName: string,
  artistName: string,
  price: number,
): Promise<string> {
  const trackRow = await db.execute({
    sql: `
      SELECT t.TrackId FROM Track t
      JOIN Album al ON t.AlbumId = al.AlbumId
      JOIN Artist ar ON al.ArtistId = ar.ArtistId
      WHERE t.Name = ? AND ar.Name = ?
    `,
    args: [trackName, artistName],
  });

  if (trackRow.rows.length === 0) {
    return `Could not find "${trackName}" by ${artistName} in the catalog.`;
  }

  const trackId = trackRow.rows[0].TrackId;

  const billingRow = await db.execute({
    sql: `
      SELECT BillingAddress, BillingCity, BillingState, BillingCountry, BillingPostalCode
      FROM Invoice WHERE CustomerId = ? LIMIT 1
    `,
    args: [DEMO_CUSTOMER_ID],
  });

  if (billingRow.rows.length === 0) {
    return "Could not retrieve billing information for this customer.";
  }

  const billing = billingRow.rows[0];

  const transaction = await db.transaction("write");
  try {
    const invoiceResult = await transaction.execute({
      sql: `
        INSERT INTO Invoice (CustomerId, InvoiceDate, BillingAddress, BillingCity, BillingState, BillingCountry, BillingPostalCode, Total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        DEMO_CUSTOMER_ID,
        new Date().toISOString().split("T")[0],
        billing.BillingAddress,
        billing.BillingCity,
        billing.BillingState,
        billing.BillingCountry,
        billing.BillingPostalCode,
        price,
      ],
    });

    const invoiceId = Number(invoiceResult.lastInsertRowid);

    await transaction.execute({
      sql: "INSERT INTO InvoiceLine (InvoiceId, TrackId, UnitPrice, Quantity) VALUES (?, ?, ?, ?)",
      args: [invoiceId, trackId, price, 1],
    });

    await transaction.commit();
    return `"${trackName}" by ${artistName} has been added to your purchases. Enjoy the music!`;
  } catch (e) {
    await transaction.rollback();
    return `Purchase failed: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    transaction.close();
  }
}
