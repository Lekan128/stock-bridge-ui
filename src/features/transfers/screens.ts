// The three transfer screens, imported together so they are one chunk: Send stock moves to the waybill
// when it is saved, and that has to work offline (MULTI_BRANCH_UX_PLAN.md rule 9) - a waybill page in a
// chunk of its own would not load without a connection.
export { SendStockPage } from '@/features/transfers/SendStockPage'
export { TransferDetailPage } from '@/features/transfers/TransferDetailPage'
export { TransfersPage } from '@/features/transfers/TransfersPage'
