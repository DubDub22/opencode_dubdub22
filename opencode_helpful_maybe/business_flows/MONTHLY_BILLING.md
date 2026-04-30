# Monthly Billing Tracker

## Overview

The system tracks Tom's (manufacturer) serial number purchases on a monthly basis. Instead of processing payments through Stripe, purchases are tracked and Eric can bill Tom monthly based on the usage.

## How It Works

### Purchase Flow

1. Tom uses `/purchase` command in Telegram
2. Selects quantity of serials
3. **Serial numbers are generated immediately** (no payment processing)
4. QR codes and engraving files are created
5. Purchase is marked as `completed` with `payment_method = "monthly_billing"`
6. Purchase is tracked for monthly billing

### Monthly Billing

- All purchases are automatically tracked by month
- Eric can view monthly summaries via Telegram commands
- Billing is based on completed purchases only
- Each purchase includes:
  - Quantity of serials
  - Price per serial
  - Total amount
  - Date and time

## Telegram Commands

### For Eric (Admin)

- `/billing` - Show current month billing summary
- `/billing [year] [month]` - Show specific month (e.g., `/billing 2024 12`)
- `/billing all` - Show summary for all months

### Example Output

```
📊 Monthly Billing Summary

Month: December 2024
Total Serials: 150
Total Amount: $1,500.00
Number of Purchases: 12

Purchase Details:
  • 2024-12-01 10:30: 10 serials @ $10.00 = $100.00
  • 2024-12-05 14:20: 25 serials @ $10.00 = $250.00
  • 2024-12-10 09:15: 15 serials @ $10.00 = $150.00
  ...
```

## Database

### Purchase Model

- `payment_method`: Set to `"monthly_billing"` for tracked purchases
- `status`: `"completed"` (serials generated immediately)
- `created_at`: Used for monthly grouping
- `quantity`: Number of serials purchased
- `total_amount`: Total cost

## Monthly Summary Features

1. **Current Month**: Shows all purchases in the current month
2. **Specific Month**: View any past month's billing
3. **All Months**: Grand total across all months
4. **Purchase Details**: Individual purchase breakdowns

## Billing Process

1. At the end of each month, Eric can run `/billing` to see the summary
2. The system shows:
   - Total number of serials created
   - Total amount owed
   - Number of purchases
   - Detailed purchase list
3. Eric bills Tom based on this information
4. Payment is handled outside the system (manual billing)

## Benefits

- **No Payment Processing**: Simpler system, no Stripe integration needed
- **Automatic Tracking**: All purchases are automatically tracked
- **Monthly Summaries**: Easy to see monthly usage
- **Historical Data**: View any past month's billing
- **Immediate Serial Generation**: Tom gets serials right away

## Configuration

No special configuration needed. The system automatically:
- Tracks all purchases
- Groups by month
- Calculates totals
- Provides summaries

## Price Configuration

The price per serial is set in `bot/handlers/serial_handler.py`:

```python
price_per_serial = 10.0  # Default price, can be configured
```

This can be moved to config or made dynamic in the future.



