# Payment System Documentation

## Overview

The system has two separate payment flows:

1. **Tom (Manufacturer) → Eric (Licensor)**: Stripe integration for serial number purchases
2. **Dealers → Eric**: Custom payment system for invoice payments

## Payment Flow 1: Tom's Serial Number Purchases (Stripe)

### How It Works

1. Tom uses `/purchase` command in Telegram bot
2. Selects quantity of serials
3. System creates purchase record
4. **Stripe payment link is generated automatically**
5. Tom receives payment link in Telegram
6. Tom clicks link and pays via Stripe Checkout
7. Webhook confirms payment
8. Serial numbers are generated automatically
9. QR codes and engraving files are created
10. Files sent to Tom via Telegram

### Stripe Integration

- **Payment Links**: Generated automatically for each purchase
- **Checkout Session**: Secure Stripe Checkout page
- **Webhooks**: Automatic payment verification
- **Success/Cancel Pages**: User-friendly redirects

### Configuration

In `.env`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Webhook Setup

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/payment/webhook/stripe`
3. Select events: `checkout.session.completed`
4. Copy webhook secret to `.env`

## Payment Flow 2: Dealer Invoice Payments (Custom)

### How It Works

1. Dealer registers and uploads FFL
2. FFL is verified (OCR + manual/automatic)
3. Dealer creates order
4. **Invoice is generated automatically (PDF)**
5. Invoice is emailed to dealer
6. Dealer clicks payment link in email or dashboard
7. Dealer pays directly on website
8. Payment is recorded
9. Order status updated

### Custom Payment Options

Currently supports:
- **Manual payment confirmation** (placeholder)
- Can be extended with:
  - Bank transfer instructions
  - ACH payment
  - Check payment
  - Another payment processor

### Invoice Payment Page

- Shows invoice details
- Payment amount
- Payment method selection
- Payment reference/confirmation
- Automatic status update

## Database Updates

### Purchase (Tom's Serial Purchases)
- `payment_method`: "stripe" or "manual"
- `payment_id`: Stripe checkout session ID
- `status`: "pending" → "completed" (after payment)

### Invoice (Dealer Orders)
- `status`: "draft" → "sent" → "paid"
- `paid_at`: Payment timestamp
- `payment_reference`: Optional payment reference

## Security

### Stripe
- Webhook signature verification
- Secure checkout sessions
- Metadata for purchase tracking

### Dealer Payments
- Invoice verification
- Payment confirmation required
- Status tracking

## Future Enhancements

### For Tom's Payments
- Recurring subscriptions
- Payment history
- Automatic retries

### For Dealer Payments
- ACH integration
- Bank transfer automation
- Payment reminders
- Late fee calculation

## Testing

### Stripe Test Mode
Use test keys for development:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Troubleshooting

### Stripe Payment Not Completing
- Check webhook endpoint is configured
- Verify webhook secret matches
- Check Stripe dashboard for events
- Review logs for errors

### Dealer Payment Issues
- Verify invoice exists
- Check payment method is selected
- Ensure database connection is working



