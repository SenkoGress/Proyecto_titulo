import { ExtractedInvoiceData, InvoiceInput } from './types';

export interface IOcrProvider {
  name: string;
  extractInvoiceData(input: InvoiceInput): Promise<ExtractedInvoiceData>;
}
