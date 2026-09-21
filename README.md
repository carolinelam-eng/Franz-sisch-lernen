# Soleil – Vokabel Lern Begleiter

Soleil ist eine mobile, installierbare Lern-App für französische Vokabeln. Eigene Listen, Lernfortschritt und bereits veröffentlichte Klassenlisten werden auf dem Gerät in IndexedDB gespeichert und bleiben offline verfügbar.

## Aktueller Funktionsumfang

- Französisch → Deutsch, Deutsch → Französisch und gemischte Abfrage
- Schreiben, Multiple Choice, Hören und gemischte Lernrunden
- eigene Vokabellisten, Beispielsätze, XP, Tagesziel und Lernserie
- ein gemeinsamer Sammlungslink für alle Geräte einer Lerngruppe
- automatische Aktualisierung veröffentlichter Listen beim Start, bei Rückkehr zur App und nach Wiederherstellung der Verbindung
- installierbare Progressive Web App mit Offline-App-Shell

Klassenkonto, echte Rangliste, Anmeldung, OCR-Scanner und Veröffentlichung durch eine berechtigte Person gehören noch nicht zu dieser Ausbaustufe. Der sichtbare Klassenbereich verwendet weiterhin Beispieldaten.

## Gemeinsamen Sammlungslink verwenden

Alle Kinder können denselben Link öffnen:

```text
https://DEIN-NAME.github.io/DEIN-REPOSITORY/?collection=SAMMLUNGSSCHLUESSEL
```

Der Link muss auf jedem Gerät nur einmal geöffnet werden. Nach erfolgreicher Verbindung entfernt die App den Schlüssel aus der sichtbaren Browseradresse und merkt sich die Sammlung lokal. Neue oder geänderte veröffentlichte Listen werden danach beim App-Start, beim Zurückkehren in die App und nach erneuter Internetverbindung geprüft. Bereits geladene Listen und der persönliche Lernfortschritt funktionieren offline.

Ein geschlossenes oder vom Betriebssystem angehaltenes Gerät kann Änderungen nicht sofort im Hintergrund empfangen. Die Aktualisierung erfolgt beim nächsten Öffnen beziehungsweise sobald die App wieder online und aktiv ist.

## Lokal entwickeln und prüfen

Voraussetzung ist Node.js 22.

```bash
npm ci
npm run dev
```

Vollständige Prüfung:

```bash
npm test
npm run test:coverage
npm run check
npm run build
npm run preview
```

Die lokale Adresse zeigt Vite im Terminal an. `npm run preview` dient zur Kontrolle der gebauten Produktionsversion einschließlich Service Worker.

## GitHub Pages einrichten

1. Den Inhalt dieses Ordners in den `main`-Branch des GitHub-Repositories hochladen.
2. Unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** auswählen.
3. Unter **Settings → Secrets and variables → Actions** anlegen:
   - Repository-Variable `VITE_SUPABASE_URL`
   - Repository-Secret `VITE_SUPABASE_ANON_KEY`
4. Den Workflow **GitHub Pages veröffentlichen** unter **Actions** abwarten.
5. Die dort angezeigte Pages-Adresse öffnen.

Der Workflow installiert reproduzierbar mit `npm ci`, führt Tests und TypeScript-Prüfung aus, baut die App und veröffentlicht ausschließlich den Ordner `dist`. Ein Supabase-Service-Role-Schlüssel darf weder in GitHub Pages noch in Variablen des Browser-Builds eingetragen werden.

## Auf dem Smartphone installieren

Auf dem iPhone die Pages-Adresse in Safari öffnen, **Teilen** und danach **Zum Home-Bildschirm** wählen. Auf Android kann die Installation über das Browsermenü oder den angezeigten Installationshinweis erfolgen.

## Datenschutz und Sicherheit

Persönlicher Lernfortschritt bleibt lokal auf dem jeweiligen Gerät. Der Browser erhält ausschließlich den öffentlichen Supabase-Anon-Key und ruft eine eingeschränkte, nur lesende Funktion für veröffentlichte Inhalte auf. Vor Schülerkonten, einer geräteübergreifenden Rangliste oder echten Klassenräumen sind ein abgestimmtes Datenschutz-, Rollen- und Berechtigungskonzept sowie die erforderlichen Einwilligungen nötig.
