import { ASSETS, allocate, toBaseUnits, validateRecipients, type Asset, type NetworkId, type PaymentIntent, type SplitRecipient } from './model';

export type RepeatDraft = {
  sourceId: string;
  network: NetworkId;
  title: string;
  description: string;
  amount: string;
  asset: Asset;
  recipients: SplitRecipient[];
};

// Copy only editable terms. Never carry over an expiry, signature, attempt,
// payment status, payer, invoice reference, or authorization from the old payment.
export function repeatDraft(payment: PaymentIntent, network: NetworkId): RepeatDraft {
  if (payment.network !== network) throw new Error('This payment belongs to a different network.');
  if (payment.status !== 'PAID' || !payment.transactionSignature || !payment.payer || !payment.paidAt) {
    throw new Error('Only a finalized payment can be repeated. Check its status in payment history.');
  }
  if (!ASSETS[payment.asset] || !Array.isArray(payment.recipients)) throw new Error('Payment details are incomplete.');
  const amount = toBaseUnits(payment.amount, ASSETS[payment.asset].decimals);
  if (amount.toString() !== payment.amountBaseUnits) throw new Error('Payment amount does not match its record.');
  const recipients = validateRecipients(payment.recipients.map((recipient) => ({
    label: recipient.label, wallet: recipient.address, bps: recipient.percentageBps,
  })));
  const amounts = allocate(amount, recipients.map((recipient) => recipient.bps));
  if (amounts.some((value, index) => value.toString() !== payment.recipients[index].amountBaseUnits)) {
    throw new Error('Recipient amounts do not match the payment record.');
  }
  return { sourceId: payment.id, network, title: payment.title, description: payment.description,
    amount: payment.amount, asset: payment.asset, recipients };
}

export function repeatHref(payment: Pick<PaymentIntent, 'id' | 'recipients'>) {
  return `${payment.recipients.length > 1 ? '/split' : '/dashboard/create'}?repeat=${encodeURIComponent(payment.id)}`;
}
