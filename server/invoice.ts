/**
 * Invoice PDF generator for DubDub22.
 * Uses pdf-lib to create a simple invoice with order details, serials, and tracking.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  dealerName: string;
  dealerEmail: string;
  dealerAddress: string;
  serialNumbers: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  shippingCost: number;
  total: number;
  trackingNumber: string;
  shipDate: string;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();

  const drawText = (text: string, x: number, y: number, size = 10, useBold = false) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color: rgb(0, 0, 0) });
  };

  const drawLine = (x: number, y: number, label: string, value: string, size = 10) => {
    drawText(label, x, y, size, true);
    drawText(value, x + 110, y, size);
  };

  // Header
  drawText("DUBDUB22", 50, 740, 24, true);
  drawText("Double T Tactical", 50, 720, 12);
  drawText("105 Bear Trce, Floresville, TX 78114", 50, 708, 10);
  drawText("docs@dubdub22.com", 50, 696, 10);

  // Invoice title
  drawText("INVOICE", 50, 660, 18, true);
  drawLine(50, 640, "Invoice #:", data.invoiceNumber);
  drawLine(50, 625, "Order #:", data.orderNumber);
  drawLine(50, 610, "Date:", data.shipDate);

  // Bill To
  drawText("Bill To:", 50, 580, 12, true);
  drawText(data.dealerName, 50, 565, 11);
  drawText(data.dealerEmail, 50, 552, 10);
  if (data.dealerAddress) {
    for (const line of data.dealerAddress.split(", ").slice(0, 3)) {
      drawText(line, 50, 539, 10);
    }
  }

  // Items table header
  const tableTop = 490;
  drawText("Item", 50, tableTop, 10, true);
  drawText("Qty", 300, tableTop, 10, true);
  drawText("Price", 380, tableTop, 10, true);
  drawText("Total", 480, tableTop, 10, true);

  // Horizontal line
  page.drawLine({ start: { x: 50, y: tableTop - 5 }, end: { x: width - 50, y: tableTop - 5 }, thickness: 1, color: rgb(0, 0, 0) });

  // Item row
  drawText("DubDub22 Suppressor", 50, tableTop - 20, 10);
  if (data.serialNumbers) {
    drawText(`S/N: ${data.serialNumbers}`, 50, tableTop - 35, 9);
  }
  drawText(String(data.quantity), 300, tableTop - 20, 10);
  drawText(`$${data.unitPrice.toFixed(2)}`, 380, tableTop - 20, 10);
  drawText(`$${data.subtotal.toFixed(2)}`, 480, tableTop - 20, 10);

  // Totals
  const totalsY = tableTop - 80;
  page.drawLine({ start: { x: 380, y: totalsY + 20 }, end: { x: width - 50, y: totalsY + 20 }, thickness: 1, color: rgb(0, 0, 0) });
  drawLine(380, totalsY, "Subtotal:", `$${data.subtotal.toFixed(2)}`);
  drawLine(380, totalsY - 15, "Shipping:", `$${data.shippingCost.toFixed(2)}`);
  drawLine(380, totalsY - 35, "Total:", `$${data.total.toFixed(2)}`, 11);

  // Tracking
  drawText(`Tracking: ${data.trackingNumber}`, 50, totalsY - 65, 10, true);
  drawText("USPS Priority Mail", 50, totalsY - 80, 10);
  drawText("Net 30 - Payment due within 30 days", 50, totalsY - 100, 10);

  // Footer
  drawText("Thank you for your order!", 50, 100, 10, true);
  drawText("Double T Tactical / DubDub22", 50, 85, 10);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
