import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

// Column widths for A4 landscape-style wide receipt
// PURCHA(7) NAME(30) Case(5) WEIGHT(9) GROSS AMT(13) %APMC(10) @BARDANA(10) @INAM(10) NET AMT(12) = ~106 chars
const C_PURCHA  = 7;
const C_NAME    = 30;
const C_CASE    = 6;
const C_WEIGHT  = 9;
const C_GROSS   = 13;
const C_APMC    = 10;
const C_BAARD   = 10;
const C_CART    = 10;
const C_NET     = 12;
const ROW_W = C_PURCHA + C_NAME + C_CASE + C_WEIGHT + C_GROSS + C_APMC + C_BAARD + C_CART + C_NET; // 107

const DASH_LINE = '_'.repeat(ROW_W);

function padR(s: string | number, w: number): string {
  const str = String(s);
  return str.length >= w ? str.substring(0, w) : str + ' '.repeat(w - str.length);
}

function padL(s: string | number, w: number): string {
  const str = String(s);
  return str.length >= w ? str.substring(0, w) : ' '.repeat(w - str.length) + str;
}

function fmtAmt(n: string | number | null | undefined): string {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (isNaN(v) || v === 0) return '';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

@Injectable()
export class BuyerSummaryPdfService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async generateBuyerSummaryPdf(firmId: string, dateFrom: string, dateTo: string): Promise<Buffer> {
    // ── Validate PDF config ───────────────────────────────────────────────────
    const [pdfConfig] = await this.dataSource.query<any[]>(
      `SELECT pdf_enabled, buyer_summary_pdf_enabled, firm_short_name, footer_text
       FROM firm_pdf_config WHERE firm_id = $1`,
      [firmId],
    );
    if (!pdfConfig?.buyer_summary_pdf_enabled) {
      throw new ForbiddenException('Buyer Summary PDF is not enabled for this firm');
    }

    // ── Fetch firm details ────────────────────────────────────────────────────
    const [firm] = await this.dataSource.query<any[]>(
      `SELECT name, address FROM firms WHERE id = $1`,
      [firmId],
    );

    // ── Fetch all AUTHORIZED KCs for the date range ──────────────────────────
    const rows = await this.dataSource.query<any[]>(
      `SELECT
         k.kc_number,
         c.name AS customer_name,
         k.total_weight_kg,
         k.total_gross_amount,
         k.total_apmc_fee,
         k.total_baardana_cost,
         k.total_net_payable,
         k.sale_date,
         COALESCE(
           (SELECT SUM(li.quantity_bags) FROM kc_line_items li WHERE li.kc_id = k.id),
           0
         ) AS total_bags,
         t.inam_amount
       FROM kaccha_chitthas k
       JOIN customers c ON c.id = k.customer_id
       LEFT JOIN trucks t ON t.id = k.truck_id
       WHERE k.firm_id = $1
         AND k.sale_date::date BETWEEN $2::date AND $3::date
         AND k.status = 'AUTHORIZED'
       ORDER BY k.sale_date ASC, k.kc_number ASC`,
      [firmId, dateFrom, dateTo],
    );

    return this.renderPdf(firm, pdfConfig, rows, dateFrom, dateTo);
  }

  private renderPdf(
    firm: any,
    pdfConfig: any,
    rows: any[],
    dateFrom: string,
    dateTo: string,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      // A4 — use landscape for wide table
      const isSingleDay = dateFrom === dateTo;
      const dateLabel = isSingleDay
        ? fmtDate(dateFrom)
        : `${fmtDate(dateFrom)} TO ${fmtDate(dateTo)}`;
      const fileLabel = isSingleDay
        ? dateFrom.replace(/-/g, '')
        : `${dateFrom.replace(/-/g, '')}-${dateTo.replace(/-/g, '')}`;

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 35, bottom: 35, left: 30, right: 30 },
        info: { Title: `Buyer Summary ${dateLabel}`, Author: firm?.name ?? '' },
      });

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const FONT   = 'Courier';
      const FONT_B = 'Courier-Bold';
      const PAGE_W = doc.page.width;   // 841 landscape
      const FS     = 8.5;
      const FS_SM  = 7.5;
      const FS_HD  = 13;

      // Courier 8.5pt ≈ 5.1px/char → 107 chars ≈ 545px; center on 841px page
      const CHAR_PX  = 5.1;
      const TABLE_W  = Math.ceil(ROW_W * CHAR_PX);   // ~545px
      const TX       = (PAGE_W - TABLE_W) / 2;        // left edge, centered

      const center = (text: string, fontSize = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fontSize);
        doc.text(text, 30, doc.y, { width: PAGE_W - 60, align: 'center', lineBreak: false });
        doc.moveDown(0.45);
      };

      const tableRow = (text: string, fontSize = FS, bold = false) => {
        doc.font(bold ? FONT_B : FONT).fontSize(fontSize);
        doc.text(text, TX, doc.y, { width: TABLE_W, align: 'left', lineBreak: false });
        doc.moveDown(0.45);
      };

      const separator = () => {
        center(DASH_LINE, FS_SM);
      };

      const colHdr =
        padR('PURCHA',  C_PURCHA) +
        padR('NAME',    C_NAME)   +
        padL('Case',    C_CASE)   +
        padL('WEIGHT',  C_WEIGHT) +
        padL('GROSS AMT', C_GROSS) +
        padL('%A.P.M.C.', C_APMC) +
        padL('@BARDANA', C_BAARD) +
        padL('@INAM',    C_CART)  +
        padL('NET AMT',  C_NET);

      // ── Header ──────────────────────────────────────────────────────────────
      center(`M/S ${(firm?.name ?? '').toUpperCase()}`, FS_HD, true);
      if (firm?.address) center(firm.address.toUpperCase(), FS_SM);
      doc.moveDown(0.3);
      center(`BUYER SUMMARY : ${dateLabel}`, FS, true);
      doc.moveDown(0.2);

      // ── Column header — between two separator lines ──────────────────────────
      separator();
      tableRow(colHdr, FS_SM, true);
      separator();

      // ── Data rows — grouped by date for multi-day ranges ────────────────────
      let totBags = 0, totWeight = 0, totGross = 0, totApmc = 0, totBaard = 0, totCart = 0, totNet = 0;

      if (!isSingleDay) {
        // Group rows by sale_date
        const byDate = new Map<string, any[]>();
        for (const r of rows) {
          const dk = new Date(r.sale_date).toISOString().slice(0, 10);
          if (!byDate.has(dk)) byDate.set(dk, []);
          byDate.get(dk)!.push(r);
        }

        for (const [dk, dayRows] of byDate) {
          // Date sub-header
          tableRow(`  --- ${fmtDate(dk)} ---`, FS_SM, true);
          let dayBags = 0, dayWeight = 0, dayGross = 0, dayApmc = 0, dayBaard = 0, dayCart = 0, dayNet = 0;

          for (const r of dayRows) {
            const line = this.buildDataRow(r);
            tableRow(line.text, FS_SM);
            dayBags += line.bags; dayWeight += line.weight; dayGross += line.gross;
            dayApmc += line.apmc; dayBaard += line.baard; dayCart += line.cart; dayNet += line.net;
          }

          // Day sub-total
          const subTot =
            padR('', C_PURCHA) + padR('Sub-total', C_NAME) +
            padL(dayBags,                C_CASE)  +
            padL(dayWeight.toFixed(2),   C_WEIGHT)+
            padL(fmtAmt(dayGross),       C_GROSS) +
            padL(fmtAmt(dayApmc),        C_APMC)  +
            padL(fmtAmt(dayBaard),       C_BAARD) +
            padL(fmtAmt(dayCart),        C_CART)  +
            padL(fmtAmt(dayNet),         C_NET);
          tableRow(subTot, FS_SM, true);

          totBags   += dayBags;  totWeight += dayWeight; totGross  += dayGross;
          totApmc   += dayApmc;  totBaard  += dayBaard;  totCart   += dayCart;  totNet    += dayNet;
        }
      } else {
        for (const r of rows) {
          const line = this.buildDataRow(r);
          tableRow(line.text, FS_SM);
          totBags += line.bags; totWeight += line.weight; totGross += line.gross;
          totApmc += line.apmc; totBaard  += line.baard;  totCart  += line.cart; totNet += line.net;
        }
      }

      // ── Grand totals row ────────────────────────────────────────────────────
      separator();
      const totRow =
        padR('', C_PURCHA) +
        padR('', C_NAME)   +
        padL(totBags,                C_CASE)   +
        padL(totWeight.toFixed(2),   C_WEIGHT) +
        padL(fmtAmt(totGross),       C_GROSS)  +
        padL(fmtAmt(totApmc),        C_APMC)   +
        padL(fmtAmt(totBaard),       C_BAARD)  +
        padL(fmtAmt(totCart),        C_CART)   +
        padL(fmtAmt(totNet),         C_NET);
      tableRow(totRow, FS_SM, true);
      separator();

      doc.moveDown(0.5);
      const footer = pdfConfig.footer_text ?? 'RATES INCLUSIVE OF ALL TAXES';
      center(footer, FS_SM);

      // store fileLabel as side-effect-free return — caller uses it for filename
      (doc as any).__fileLabel = fileLabel;

      doc.end();
    });
  }

  /** Extract numeric values and build a formatted data row string */
  private buildDataRow(r: any): {
    text: string; bags: number; weight: number; gross: number;
    apmc: number; baard: number; cart: number; net: number;
  } {
    const kcNum  = String(r.kc_number).replace(/^KC-\d{4}-0*/, '');
    const bags   = Number(r.total_bags);
    const weight = Number(r.total_weight_kg);
    const gross  = Number(r.total_gross_amount);
    const apmc   = Number(r.total_apmc_fee);
    const baard  = Number(r.total_baardana_cost);
    const cart   = Number(r.inam_amount ?? 0);
    const net    = Number(r.total_net_payable);

    const text =
      padR(kcNum,                 C_PURCHA) +
      padR(r.customer_name ?? '', C_NAME)   +
      padL(bags || '',            C_CASE)   +
      padL(weight.toFixed(2),     C_WEIGHT) +
      padL(fmtAmt(gross),         C_GROSS)  +
      padL(fmtAmt(apmc),          C_APMC)   +
      padL(fmtAmt(baard),         C_BAARD)  +
      padL(fmtAmt(cart),          C_CART)   +
      padL(fmtAmt(net),           C_NET);

    return { text, bags, weight, gross, apmc, baard, cart, net };
  }
}
