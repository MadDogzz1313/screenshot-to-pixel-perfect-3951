# Leonida Explorer – Status

## Umgesetzt (Demo-Modus, lokale Beispieldaten)
- Anmeldeseite: E-Mail/Passwort, Registrieren, „Ohne Anmeldung zur Karte“ (Demo, keine echte Prüfung)
- Karte: zoom-/verschiebbare Bildkarte (Pinch, Buttons), prozentgenaue Marker, Suche, Kategorie-Filter, Detail-Vorschau
- Platzhalterkarte `src/assets/map-placeholder.jpg` austauschbar (Verhältnis in `MapCanvas.tsx` → `MAP_RATIO`)
- Navigation: Karte, Entdecken, Beitrag, Community, Profil
- Beitragsformular mit 6 Kategorien, Foto-Auswahl (Typ/Größe geprüft), Fahrzeug-Typ, Uhrzeit 00–23, Standort auf Karte, Status „wartet auf Freigabe“
- Fundort-Details: Galerie, Typ, Uhrzeit, Gebiet, Beschreibung, Like, Merken, Teilen, Ersteller mit Level-Abzeichen → öffentliches Profil
- Profile: Avatar, Name, Bio (bearbeitbar), bestätigte Fundorte, Likes, XP-Balken; Level I–C nach 25*(L-1)^2+75*(L-1)
- Admin (Demo: E-Mail beginnt mit `admin@`): freigeben, ablehnen, ausblenden, wiederherstellen

## Noch fehlend
- Lovable-Cloud-Anbindung: echte Anmeldung, Datenbank, Speicher für Fotos
- Migration `docs/migrations/001_leonida_schema.sql` anwenden (RLS, serverseitige XP, Admin-Rollen)
- Avatar-Upload, Benachrichtigungen, echte Kartenvorlage, iOS-Verpackung (z. B. Capacitor)
