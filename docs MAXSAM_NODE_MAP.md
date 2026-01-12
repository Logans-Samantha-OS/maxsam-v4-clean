# MAXSAM NODE-BY-NODE MAP (AUTHORITATIVE)

This map defines the complete n8n workflow. No nodes may be added, removed, or reordered without updating this document.

1. Scheduled Trigger (6hr)
2. Webhook Trigger (/webhook/maxsam-manual-trigger)
3. Merge Triggers
4. ALEX Gemini Lead Extractor
5. Parse Gemini Response
6. Check Duplicate Lead (Supabase)
7. New Lead Check (Router)
8. Insert New Lead
9. Update Existing Lead
10. ALEX SerpAPI Search
11. ALEX Browserless Skip Trace
12. ALEX Extract Contact Info
13. Update Contact Info
14. ELEANOR Priority Scoring (0–100)
15. Update Lead Score
16. Ready for Outreach Check (≥40 + phone)
17. Critical Priority Check (≥85)
18. SAM Claude Generate Outreach
19. Parse SAM Response
20. Twilio Send SMS
21. Log Outreach
22. Update Outreach Status
23. Telegram Notification
24. Telegram Critical Alert
25. Webhook Twilio Incoming
26. SAM Classify Response
27. Log SMS Response

This map is binding.
