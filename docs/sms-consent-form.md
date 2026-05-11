# Axmen Recycling SMS Consent Acknowledgment

*Print one copy per staff member whose phone number will receive SMS
callback alerts from the Axmen Recycling voice agent. Have them sign
before their number is entered into the system. File the signed form in
the employee's HR record. Twilio reviewers may ask to see a copy when
auditing the A2P 10DLC campaign.*

---

**Montana Recycling Inc (dba Axmen Recycling) — SMS Consent Acknowledgment**

**Program:** Axmen Recycling Voice Agent — Callback Alerts

I, ______________________________________________ (print full name),
agree to receive SMS text messages from Montana Recycling Inc (dba
Axmen Recycling) on the mobile phone number listed below as part of my
work duties.

**Phone number:** +1 (_____) _____ - __________

**What I will receive.** Internal callback alerts triggered by the
Axmen Recycling AI voice agent when a customer calls and requests a
callback. A typical message includes the caller's name, phone number,
and what they were asking about, for example:

> *New Axmen callback: Knight (4063707164) — tow vehicle towed from
> Missoula to Frenchtown. Reply STOP to unsubscribe.*

**What I will NOT receive.** Marketing messages, promotional offers, or
messages unrelated to incoming Axmen Recycling customer callbacks.

**Frequency.** Typically fewer than 20 messages per day across all
recipients combined. Some days you may receive several messages; some
days none.

**Cost.** Message and data rates may apply, depending on my mobile
carrier and plan. Axmen Recycling does not charge for these messages.

**How to stop receiving messages.** I can stop at any time by:

- Replying **STOP** to any message from the Axmen Recycling alert
  number.
- Asking the Axmen Recycling office to remove my phone number from the
  alert list.
- Signing and returning a written revocation of this consent to the
  office.

After I opt out, I may receive one final confirmation message and no
further messages will be sent.

**Help.** I can reply **HELP** to any message, call the Axmen Recycling
office at (406) 543-1905, or email recycling@axmen.com for assistance.

**Privacy.** Axmen Recycling will only use my phone number for the
purposes described above. The number is stored in the voice-agent
backend configuration and is not shared with third parties except
Twilio (the SMS carrier gateway) for the sole purpose of delivering
these messages.

**Acknowledgment.** I am giving this consent freely. I understand that
consent to receive SMS is not a condition of my employment, and I can
revoke it at any time without affecting my employment.

---

**Signature:** ________________________________________

**Date:** _____ / _____ / _________

**Admin who added the number to the alert list:** ____________________________

**Date entered:** _____ / _____ / _________

---

*For internal use: after this form is signed, the admin adds the
phone number to the `SMS_RECIPIENTS` Vercel environment variable for
the `recyclingagent` project (E.164 format, comma-separated). Keep
this signed paper form in the employee's HR file in case Twilio /
the carriers ever audit the A2P campaign.*
