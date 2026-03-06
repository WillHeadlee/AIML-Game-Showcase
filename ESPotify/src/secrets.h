#pragma once

// ============================================================
// ESPotify Secrets - COPY THIS FILE TO secrets.h
// ============================================================
// 1. Copy this file:  cp secrets.h.example secrets.h
// 2. Fill in your credentials below
// 3. NEVER commit secrets.h to git!

// --- WiFi Credentials ---
#define WIFI_SSID         "SCOTTCAMPUS"
#define WIFI_PASS         "mavericks"

// --- Spotify API Credentials ---
// Create an app at https://developer.spotify.com/dashboard
// Redirect URI: after flashing, check serial monitor for the ESP32's IP,
// then add  http://192.168.X.X/callback  to your Spotify app's redirect URIs.
// The IP is printed on boot and shown on the OLED auth screen.
#define SPOTIFY_CLIENT_ID     "06929aa214d642b0813a2d6b76ea3720"
#define SPOTIFY_CLIENT_SECRET "ac5692bc3e48402191130da083985abc"
#define SPOTIFY_REFRESH_TOKEN "AQAMkRbyYltpZYt6cnEV31GVWNS8bXTlTr95wvN6ammmAY3RyEWlGdBGdW1X3YyEWmkR10d4mk0vwlq2uahjZ2FoM89AjcJuOylU98OMCpme5f3EeHY4AZnaLuAgVRH4SgA"
