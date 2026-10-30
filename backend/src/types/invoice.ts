export interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
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
  };
}
