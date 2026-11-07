export interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
  replaces_invoice_number?: string | null;
  clinic: {
    name: string;
    address: string;
    contact_number: string;
    footer_line: string;
  };
  doctor: {
    first_name: string;
    last_name: string;
    specialty: string | null;
    practice_name: string | null;
  };
  patient: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    date_of_birth: Date | null;
    sex: string | null;
  };
  appointment: {
    date: Date | null;
    reason_for_visit: string | null;
  };
  charges: Array<{
    charge_type: string;
    description: string | null;
    name: string | null;
    amount: number;
    quantity: number | null;
    unit_price: number | null;
  }>;
  payment: {
    consultation_amount: number;
    charges_total: number;
    subtotal: number;
    total_amount: number;
    advance_payment: number;
    remaining_balance_before_payment: number;
    payment_method: string;
    cash_tendered: number;
    amount_applied: number;
    change_amount: number;
    final_balance: number;
    transactions?: Array<{
      id: string;
      kind: string;
      method: string;
      amount: number;
      status: string;
      reference_no: string | null;
      created_at: Date;
    }>;
  };
}

export type BillingStatus = 'UNPAID' | 'FOR_REVIEW' | 'PARTIAL' | 'PAID' | 'OVERPAID';

export type PaymentTransactionKind = 'PAYMENT' | 'REFUND';
export type PaymentTransactionMethod = 'CASH' | 'GCASH';
export type PaymentTransactionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'VOIDED';
export type PaymentTransactionSource = 'PATIENT_UPLOAD' | 'SECRETARY';

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  kind: PaymentTransactionKind;
  method: PaymentTransactionMethod;
  amount: number;
  status: PaymentTransactionStatus;
  receipt_url: string | null;
  reference_no: string | null;
  patient_declared_amount: number | null;
  source: PaymentTransactionSource;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reject_reason: string | null;
  reject_note: string | null;
  voided_by: string | null;
  voided_at: Date | null;
  void_reason: string | null;
  void_note: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface Payment {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  payment_method: string;
  consultation_amount: number;
  total_additional_charges: number;
  total_amount: number;
  status: string;
  receipt_url: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BillingSummary {
  billTotal: number;
  acceptedPayments: number;
  acceptedRefunds: number;
  netPaid: number;
  balance: number;
  billingStatus: BillingStatus;
  pendingCount: number;
}
