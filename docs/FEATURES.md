# Leonida Explorer – Status

## Umgesetzt mit Lovable Cloud
- Echte Registrierung/Anmeldung/Abmeldung (Supabase Auth, E-Mail-Bestätigung aktiv, Sitzung bleibt gespeichert)
- „Passwort vergessen?“: Link per E-Mail (resetPasswordForEmail, redirect `/passwort-neu`), neues Passwort auf `/passwort-neu`; abgelaufene Links werden erkannt
- Profile aus `profiles` (Name, Bild, XP, Level), Bio speichern; Community zeigt echte + Demo-Profile
- Rollen `user`/`admin`: Admin-Prüfung über Datenbank-Funktion `has_role` (mit Nutzer-Token); „admin@“-Regel entfernt
- Gastmodus: Karte ansehen ohne Anmeldung, Beiträge nur angemeldet
- Beitragssystem: Fundorte in `spots` (pending → Admin gibt frei/lehnt ab/blendet aus), Fotos in Storage `spot-photos` + `spot_photos`; Karte/Entdecken zeigen nur freigegebene; Demo-Fundorte/-Profile entfernt
- SQL-Entwurf `docs/migrations/003_spots_xp_photos.sql` (genau 50 XP pro erster Freigabe, Foto-Speicher)
- SQL-Entwurf `docs/migrations/002_auth_roles.sql` (Rolle „user“ + Profilbild bei Registrierung, Rechte-Härtung) – über Lovable anwenden

- Emergent-Deployment: `frontend/` (SPA-Build-Wrapper) + `backend/` (FastAPI `/api/health`); Lovable unverändert
- Kartenseite im Layout der Designvorlage: Profil-/Glocken-Button, zweizeiliges Logo + „GTA VI COMMUNITY MAP“, Suche + Filter-Button (Kategorien im Panel), Hauptkarte `src/assets/leonida-map.jpg` (827×1140) mit „Fit to Screen“-Startansicht (contain), Pinch-/Button-Zoom bis 8×, Verschieben, „Ganze Karte“-Reset, Ebenen (Fundorte ein/aus), Fundort-Zähler + „Fundort vorschlagen“.
- PWA: `public/manifest.webmanifest` („Leonida Explorer“, standalone), Icons `public/icons/` (192, 512, maskable 512, apple-touch 180), iPhone-Home-Bildschirm-Meta in `__root.tsx`, viewport-fit=cover

## Umgesetzt (Demo-Modus, lokale Beispieldaten)
- Karte: zoom-/verschiebbare Bildkarte (Pinch, Buttons), prozentgenaue Marker, Suche, Kategorie-Filter, Detail-Vorschau
- Kartenbild `src/assets/leonida-map.jpg` austauschbar (Maße in `MapCanvas.tsx` → `MAP_W`/`MAP_H`); Fundorte in % (x/y)
- Navigation: Karte, Entdecken, Beitrag, Community, Profil
- Beitragsformular mit 6 Kategorien, Foto-Auswahl (Typ/Größe geprüft), Fahrzeug-Typ, Uhrzeit 00–23, Standort auf Karte, Status „wartet auf Freigabe“
- Fundort-Details: Galerie, Typ, Uhrzeit, Gebiet, Beschreibung, Like, Merken, Teilen, Ersteller mit Level-Abzeichen → öffentliches Profil
- Profile: Avatar, Name, Bio (bearbeitbar), bestätigte Fundorte, Likes, XP-Balken; Level I–C nach 25*(L-1)^2+75*(L-1)
- Admin (nur Rolle `admin` in `user_roles`, serverseitig geprüft): freigeben, ablehnen, ausblenden, wiederherstellen (Fundorte noch Demo-Daten)

## Noch fehlend
- Merken in Lovable Cloud (spot_saves) – aktuell nur auf dem Gerät
- 002 + 003 über Lovable anwenden
- Migration `docs/migrations/001_leonida_schema.sql` anwenden (RLS, serverseitige XP, Admin-Rollen)
- Avatar-Upload, Benachrichtigungen, echte Kartenvorlage, iOS-Verpackung (z. B. Capacitor, optional – PWA vorhanden)
