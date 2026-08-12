# CA Smart Staycation — Google Play Store Listing Package

## App identity
- App name: CA Smart Staycation
- Application ID: `com.casmartstaycation.app`
- Category: Travel & Local
- Primary purpose: Guest accommodation booking and stay information
- Target audience: Guests looking to view accommodation information and make bookings with CA Smart Staycation

## Short description
Book your CA Smart Staycation stay, view accommodation details, photos, amenities, and booking information.

## Full description
CA Smart Staycation makes it easier to explore and book your stay.

Browse available accommodation, view unit photos and amenities, review booking details, and submit your reservation information from your Android device. The app connects to the CA Smart Staycation online booking service so guests can access the latest booking information and accommodation details.

### Features
• View available accommodation
• Browse unit photos
• View unit descriptions and amenities
• Select booking dates and guest information
• Review booking charges and booking details
• Submit booking information online
• Access the CA Smart Staycation guest booking service from Android

Whether you are planning a short stay or a family getaway, CA Smart Staycation provides a convenient mobile way to access the accommodation booking service.

Internet access is required for online booking and current accommodation information.

## Suggested tags / keywords
staycation, accommodation, booking, hotel, vacation rental, travel, Pampanga, Azure North, San Fernando Pampanga

## App category
Travel & Local

## Content rating
Recommended initial classification: suitable for a general audience. Complete Google's questionnaire in Play Console based on the final app behavior and content.

## Data Safety — preparation notes
The Play Console Data Safety form must be completed from the actual production data flows. Do not copy these notes blindly into Play Console.

The current app is a WebView-based client for the CA Smart Staycation booking website. The website/backend may process booking and guest information supplied by users. Review the backend routes, authentication, file uploads, analytics, cookies, and hosting providers before declaring the final data categories.

Potential data categories to review:
- Personal information supplied during a booking (for example name and contact information)
- Booking/accommodation information
- Payment/proof-of-payment information if the website allows uploads
- Photos/files uploaded by users, if applicable

Potential purposes to review:
- App functionality
- Booking/service delivery
- Customer support
- Security/fraud prevention

## Privacy policy
A public privacy-policy URL must be supplied in Play Console and should be reachable without login. The policy must accurately describe the production website, Android app, backend, storage providers, data retention/deletion, contact method, and user rights.

Recommended repository location for the source policy: `docs/privacy-policy.md`.

Do not publish a placeholder privacy policy. Replace it with the final business-approved policy before production submission.

## Store assets checklist
Prepare these assets in Play Console:
- App icon: 512 × 512 PNG
- Feature graphic: 1024 × 500 PNG/JPG
- Phone screenshots: at least 2, showing real app screens
- Additional tablet screenshots if the app is marketed to tablets
- Optional promotional video

Do not use screenshots containing test accounts, private guest information, internal admin data, or debug UI.

## Release checklist
- [ ] Google Play developer account verified
- [ ] Developer identity/contact information completed
- [ ] App created in Play Console
- [ ] Application ID confirmed as `com.casmartstaycation.app`
- [ ] Production AAB uploaded
- [ ] Release signing configured with Google Play App Signing
- [ ] Privacy policy URL added
- [ ] Data Safety form completed from actual production data flows
- [ ] Content rating questionnaire completed
- [ ] Target audience completed
- [ ] App access instructions supplied if required
- [ ] Store listing completed
- [ ] App icon and feature graphic uploaded
- [ ] Phone screenshots uploaded
- [ ] Internal/closed testing completed as required by Play Console
- [ ] Production release submitted for review

## Release notes — version 1.1
- Improved Android release configuration
- Updated Android target for current Google Play requirements
- Improved guest booking experience
- Accommodation gallery and unit information support
- Photo viewer navigation improvements

## Important publishing note
This document is a technical/store-preparation package. Google Play Console requirements can change, and the final Data Safety, privacy, content rating, target-audience, and app-access declarations must reflect the actual production implementation at submission time.
