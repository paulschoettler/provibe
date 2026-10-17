import "server-only";

/**
 * Serverlogik Bestellungen (Backoffice). Einstieg für die Seiten aus Welle 2.
 * Jede schreibende Funktion prüft die Rolle des übergebenen Staff-Benutzers (requireStaff in der
 * Server Action davor), validiert mit Zod, schreibt order_events und audit_log und wirft bei
 * Fehlern AdminOrderError (toActionError macht daraus ein anzeigbares Ergebnis).
 */
export { listOrders, getOrder, applyOrderFilter } from "./read";
export type {
  OrderListRow,
  OrderListResult,
  OrderDetail,
  OrderDetailItem,
  OrderDetailEvent,
  OrderDetailNote,
  OrderDetailShipment,
  OrderDetailRefund,
} from "./read";
export {
  transitionOrder,
  markManualPaymentReceived,
  addOrderNote,
  canSetStatus,
} from "./transition";
export {
  createRefund,
  previewRefund,
  refundInputSchema,
  type RefundInput,
  type RefundResult,
} from "./refund";
export {
  createManualOrder,
  manualOrderSchema,
  type ManualOrderInput,
  type ManualOrderResult,
} from "./manual";
export { exportOrdersCsv, type OrdersCsvExport } from "./export";
export { AdminOrderError, isAdminOrderError, toActionError } from "./errors";
export * from "./status";
export { parseOrderFilter, PAYMENT_METHOD_FILTERS, ORDER_SORTS, type OrderFilter } from "./filters";
export { shippingEmail, refundEmail } from "./emails";
