# Dealer Sample System Documentation

## Overview

First-time dealers can order a $25 dealer sample when they scan their FFL for the first time. This is a one-time offer per dealer.

## Features

### Dealer Sample
- **Price**: $25.00
- **Availability**: Only for dealers who haven't ordered a sample before
- **One-time only**: Once ordered, option disappears
- **Tracked**: `Dealer.has_ordered_sample` flag

### Shipping Calculation
- **Free Shipping**: When ordering 10+ cans
- **Flat Rate**: $15.00 USPS shipping for orders with less than 10 cans
- **Applies to**: All orders (including dealer samples)

## Workflow

### First-Time Dealer
1. Dealer uploads FFL document
2. FFL is verified
3. Dealer sees order form with:
   - ✅ **Dealer Sample option** ($25) - Available
   - Regular cans ($60 each)
   - Consumable parts (if FFL 01 or 07)
4. Dealer can order sample alone or with other items
5. After sample order, flag is set: `has_ordered_sample = True`

### Returning Dealer
1. Dealer logs in
2. Order form shows:
   - ❌ **Dealer Sample option** - Not available (already ordered)
   - Regular cans ($60 each)
   - Consumable parts (if FFL 01 or 07)

## Pricing Examples

### Example 1: Dealer Sample Only
- Dealer Sample: $25.00
- Shipping: $15.00 (USPS - less than 10 cans)
- **Total: $40.00**

### Example 2: 5 Cans
- 5 × Cans: $300.00
- Shipping: $15.00 (USPS - less than 10 cans)
- **Total: $315.00**

### Example 3: 10 Cans (Free Shipping)
- 10 × Cans: $600.00
- Shipping: FREE (10+ cans)
- **Total: $600.00**

### Example 4: Dealer Sample + 12 Cans
- Dealer Sample: $25.00
- 12 × Cans: $720.00
- Shipping: FREE (10+ cans)
- **Total: $745.00**

## Database Changes

### Dealer Model
- Added: `has_ordered_sample` (Boolean, default=False)
- Tracks if dealer has already ordered a sample

### DealerOrder Model
- Added: `is_dealer_sample` (Boolean, default=False)
- Indicates if this order includes a dealer sample

## Invoice Display

- Dealer sample appears as separate line item: "Dealer Sample - $25.00"
- Shipping shows as "FREE" or "$15.00 (USPS)"
- All items itemized on invoice PDF

## Restrictions

- ✅ Sample can be ordered with other items
- ✅ Sample can be ordered alone
- ❌ Only one sample per dealer (ever)
- ❌ Sample option disappears after first order

## Future Enhancements

- Sample expiration date
- Sample quantity limits
- Sample-specific shipping options



