# Public Static Files

This directory contains static files served by the backend API.

## GCash QR Code

**File:** `gcash-qr.jpg`

This file contains the clinic's GCash QR code image. Patients will scan this QR code to pay for their appointments.

### Instructions:

1. The GCash QR code image should be named `gcash-qr.jpg` in this directory
2. The image should be clear and easily scannable
3. Recommended size: 512x512 pixels or larger

### Current Status:

The `gcash-qr.jpg` file currently contains a temporary QR code for testing purposes. Replace it with the actual GCash QR code generated from the clinic's GCash account before production deployment.

### Access:

The QR code is accessible via: `GET /api/v1/payments/gcash-qr`

This endpoint returns a JSON response with the QR code URL:
```json
{
  "success": true,
  "data": {
    "qrUrl": "/public/gcash-qr.jpg"
  },
  "message": "GCash QR code URL retrieved"
}
```

The actual image is served as a static file at: `http://localhost:3000/public/gcash-qr.jpg`

If the QR code image is not present, the mobile app will display a placeholder icon.