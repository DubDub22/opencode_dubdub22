# ATF eForms Automation

## Overview

This system provides browser automation to automatically fill out ATF eForms (Form 2 and Form 3) for suppressor serial numbers. The automation uses Playwright to control a browser and fill forms, but **requires manual review and submission** to ensure accuracy and compliance.

## Features

- **Form 2 Automation**: Auto-fill Application to Make and Register a Firearm
- **Form 3 Automation**: Auto-fill Application to Transfer a Firearm
- **Screenshot Capture**: Automatic screenshots for record-keeping
- **Draft Saving**: Forms are saved as drafts for review before submission (default)
- **Auto-Submit**: Optional automatic submission without review
- **Status Tracking**: Track submission status in database
- **Submission ID Capture**: Automatically captures ATF submission ID

## Auto-Submit Configuration

The system supports two modes:

### Draft Mode (Default - Recommended)
- Forms are saved as drafts for manual review
- Browser stays open for you to verify information
- You submit manually after review
- Set `EFORMS_AUTO_SUBMIT=false` (or omit it)

### Auto-Submit Mode
- Forms are automatically submitted after filling
- Submission ID is captured automatically
- Browser closes after submission
- Set `EFORMS_AUTO_SUBMIT=true`

⚠️ **Warning**: Auto-submit mode bypasses manual review. Only enable if:
- You have thoroughly tested the automation
- You trust the data accuracy
- You understand you are responsible for all submissions

## Legal Considerations

⚠️ **IMPORTANT**: This automation tool assists with form completion and submission. 

- You are responsible for ensuring all information is accurate
- You are responsible for compliance with all ATF regulations
- The ATF has acknowledged the value of third-party tools that assist with data population (House Report 118-582)
- Automated submission is legal, but accuracy is your responsibility

## Setup

### 1. Install Playwright

```bash
pip install playwright
playwright install chromium
```

### 2. Configure eForms Credentials

Add to your `.env` file:

```bash
# ATF eForms Credentials
EFORMS_USERNAME=your_eforms_username
EFORMS_PASSWORD=your_eforms_password
EFORMS_AUTO_SUBMIT=false  # Set to 'true' to auto-submit without review

# Manufacturer Information (for Form 2 and Form 3)
MANUFACTURER_NAME=Your Company Name
MANUFACTURER_ADDRESS=123 Main St
MANUFACTURER_CITY=Your City
MANUFACTURER_STATE=ST
MANUFACTURER_ZIP=12345
MANUFACTURER_FFL=01-12345-01-23456
```

### 3. Database Migration

The system includes an `EFormsSubmission` model to track submissions. Run database migrations to create the table:

```python
from database.models import Base, EFormsSubmission
from bot.utils.database import engine
Base.metadata.create_all(engine)
```

## Usage

### Telegram Commands

#### Fill Form 2 (Application to Make)

```
/eforms_form2 <serial_number>
```

Example:
```
/eforms_form2 DUB22-00001
```

This will:
1. Open a browser window
2. Log into eForms
3. Navigate to Form 2
4. Fill in all fields from database and config
5. Save as draft OR submit automatically (based on `EFORMS_AUTO_SUBMIT` setting)
6. Take a screenshot
7. Capture ATF submission ID (if submitted)
8. Keep browser open (if draft) or close (if submitted)

#### Fill Form 3 (Application to Transfer)

```
/eforms_form3 <serial_number>
```

Example:
```
/eforms_form3 DUB22-00001
```

This will:
1. Open a browser window
2. Log into eForms
3. Navigate to Form 3
4. Fill in transferor (manufacturer) and transferee (customer) information
5. Save as draft OR submit automatically (based on `EFORMS_AUTO_SUBMIT` setting)
6. Take a screenshot
7. Capture ATF submission ID (if submitted)
8. Keep browser open (if draft) or close (if submitted)

**Note**: Form 3 requires a customer to be registered for the serial number.

#### Check Submission Status

```
/eforms_status <serial_number>
```

Example:
```
/eforms_status DUB22-00001
```

Shows all eForms submissions (Form 2 and Form 3) for a serial number.

## How It Works

### Form 2 Flow

1. **Data Collection**: Retrieves serial number, manufacture date, revision from database
2. **Manufacturer Info**: Uses configured manufacturer information
3. **Form Filling**: Automatically fills all form fields
4. **Draft Save**: Saves form as draft (does not submit)
5. **Screenshot**: Captures full-page screenshot for records
6. **Review**: Browser stays open for manual review

### Form 3 Flow

1. **Data Collection**: Retrieves serial number and customer information
2. **Transferor Info**: Uses configured manufacturer information
3. **Transferee Info**: Uses customer information from database
4. **Form Filling**: Automatically fills all form fields
5. **Draft Save**: Saves form as draft (does not submit)
6. **Screenshot**: Captures full-page screenshot for records
7. **Review**: Browser stays open for manual review

## Form Field Mapping

### Form 2 Fields

- **Serial Number**: From `SerialNumber.serial`
- **Manufacturer Name**: From `MANUFACTURER_NAME`
- **Manufacturer Address**: From `MANUFACTURER_ADDRESS`, `MANUFACTURER_CITY`, `MANUFACTURER_STATE`, `MANUFACTURER_ZIP`
- **FFL Number**: From `MANUFACTURER_FFL`
- **Firearm Type**: "Silencer"
- **Model**: "DubDub22"
- **Caliber**: "Multi" (configurable)
- **Revision**: From `SerialNumber.revision`
- **Manufacture Date**: From `SerialNumber.manufacture_date`

### Form 3 Fields

- **Serial Number**: From `SerialNumber.serial`
- **Transferor (Manufacturer)**: Same as Form 2 manufacturer info
- **Transferee (Customer)**: From `Customer` model
- **Firearm Information**: Same as Form 2

## Customization

### Updating Form Selectors

The eForms website may change its structure. If automation fails, you may need to update selectors in `bot/services/eforms_automation.py`.

To find correct selectors:
1. Open eForms in browser
2. Right-click on form fields
3. Select "Inspect Element"
4. Note the `name`, `id`, or `data-field` attributes
5. Update selectors in the automation service

### Adding Additional Fields

To add more fields to the automation:

1. Add field to `form_data` dictionary in `fill_form_2()` or `fill_form_3()`
2. Add corresponding config value to `Config` class
3. Update `.env` file with new value

## Troubleshooting

### Browser Won't Start

- Ensure Playwright is installed: `playwright install chromium`
- Check if display is available (for headless=False)
- Try running with `headless=True` in code

### Login Fails

- Verify credentials in `.env` file
- Check if eForms website structure has changed
- Verify selectors in `login()` method

### Form Fields Not Filling

- eForms website structure may have changed
- Update selectors in `fill_form_2()` or `fill_form_3()`
- Check browser console for errors
- Take screenshot to see current state

### Selector Not Found

The automation tries multiple selector strategies:
- `input[name="field_name"]`
- `input[id="field_name"]`
- `textarea[name="field_name"]`
- `select[name="field_name"]`
- `[data-field="field_name"]`

If none work, you'll need to inspect the actual eForms page and update selectors.

## Screenshots

Screenshots are automatically saved to:
```
/eforms_screenshots/form2_DUB22-00001_20240101_120000.png
/eforms_screenshots/form3_DUB22-00001_20240101_120000.png
```

These are stored in the database and can be retrieved for records.

## Database Tracking

The `EFormsSubmission` model tracks:
- Serial number ID
- Form type (Form2, Form3)
- Status (draft, filled, submitted, approved, rejected)
- Fill/submit timestamps
- ATF submission ID (after submission)
- Screenshot path
- Form data (JSON)
- Error messages

## Submission Modes

### Draft Mode (Manual Submission)

After the automation fills the form:

1. **Review** all fields in the browser
2. **Verify** all information is correct
3. **Attach** any required documents
4. **Submit** manually through the eForms interface
5. **Record** the ATF submission ID (update database if needed)

### Auto-Submit Mode

The automation will:
1. Fill all form fields
2. Automatically click submit
3. Capture the ATF submission ID
4. Save to database
5. Close the browser

**Note**: In auto-submit mode, you cannot review or attach documents before submission. Ensure all data is correct in your database before enabling this mode.

## Security Notes

- eForms credentials are stored in `.env` (not in code)
- Screenshots may contain sensitive information
- Ensure `.env` file is in `.gitignore`
- Use secure password storage practices

## Future Enhancements

Potential improvements:
- Automatic document attachment
- Form submission automation (with confirmation)
- Status polling from ATF
- Batch processing multiple serials
- Integration with FastBound
- Email notifications on status changes

## Support

If you encounter issues:
1. Check logs for error messages
2. Verify all configuration values are set
3. Test with a single serial number first
4. Review screenshots to see form state
5. Update selectors if eForms structure changed

## Compliance

Remember:
- ✅ Automation assists with data entry
- ✅ Manual review is required
- ✅ You are responsible for accuracy
- ✅ Compliance with ATF regulations is mandatory
- ❌ Do not automate submission without review
- ❌ Do not bypass ATF requirements

