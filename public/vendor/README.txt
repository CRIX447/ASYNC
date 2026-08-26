PHOTON SDK GOES IN THIS FOLDER
==============================

You need ONE file here:

    Photon-Javascript_SDK.js

HOW TO GET IT
-------------
1. Go to  https://www.photonengine.com/sdks#realtime-sdkrealtimejavascript
2. Download the Realtime JavaScript SDK (a .zip).
3. Unzip it. Find the library file inside the  /lib  folder.
   It is named  Photon-Javascript_SDK.js
   (there is also a .min.js version -- either works, but keep the filename
   as Photon-Javascript_SDK.js or change sdkPath in src/config/manifest.js)
4. Copy that ONE file into this folder.

You do not need anything else from the zip. The demos, docs and src folders
can be deleted.

THEN GET YOUR APP ID
--------------------
1. Sign up free at  https://dashboard.photonengine.com
2. Click "Create a New App"
3. Photon Type: REALTIME     (not Voice, not Chat, not Fusion)
4. Name it anything.
5. Copy the App ID -- a long string of letters and numbers.
6. Paste it into  src/config/manifest.js  as PHOTON.appId

PICK YOUR REGION
----------------
In src/config/manifest.js set PHOTON.region to whichever is closest:

    au   Australia          eu   Europe
    us   US East            usw  US West
    asia Singapore          jp   Japan
    in   India              sa   South America
    kr   South Korea        cae  Canada East

Everyone in a room must use the SAME region, or you won't see each other.

FREE TIER
---------
20 concurrent users, free forever, no credit card. That is 20 people playing
at the same time -- plenty for playtesting and small releases.

WHY ISN'T THIS FILE IN THE REPO ALREADY?
----------------------------------------
Photon's licence doesn't allow redistributing their SDK, so you have to
download it yourself. It's a two-minute job and you only do it once.
