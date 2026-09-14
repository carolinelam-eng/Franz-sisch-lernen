# Soleil – Vokabel Lern Begleiter

Eine mobile, installierbare Lern-App für französische Vokabeln. Der Prototyp funktioniert ohne Backend und speichert alle eigenen Listen sowie Lernfortschritte lokal auf dem verwendeten Gerät.

## Enthaltene Funktionen

- Französisch → Deutsch, Deutsch → Französisch und gemischte Abfrage
- Schreibmodus, Multiple Choice, Hörmodus und gemischte Lernrunde
- eigene Vokabellisten und Beispielsätze
- XP, Tagesziel, Lernserie und getrennte Fehlerwerte je Sprachrichtung
- simulierte geschlossene Klassenrangliste und gemeinsames Wochenziel
- Demo-Scanner mit überprüfbarem Beispielimport
- Offline-Nutzung und Installation auf dem Smartphone

## Wichtiger Hinweis zum Prototyp

Anmeldung, Scanner, Einladungscode, Rangliste und Teilen sind als Vorschau umgesetzt. Es werden noch keine Daten zwischen verschiedenen Geräten synchronisiert. Eigene Vokabeln und Fortschritte liegen ausschließlich im Browser des jeweiligen Geräts.

## Lokal öffnen

Die App benötigt wegen des Service Workers einen lokalen Webserver:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` im Browser öffnen.

Tests:

```bash
npm test
npm run check
```

## Bei GitHub hochladen

1. Auf GitHub ein neues, leeres Repository erstellen.
2. Den Inhalt dieses Ordners in das Repository hochladen. `index.html` muss direkt im Stammverzeichnis liegen.
3. Als Standardbranch `main` verwenden.
4. Unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** auswählen.
5. Den Workflow unter **Actions** abwarten. Anschließend zeigt GitHub dort die Internetadresse der App an.

Alternativ per Git:

```bash
git init
git add .
git commit -m "Initiale Soleil App"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/DEIN-REPOSITORY.git
git push -u origin main
```

## Auf dem iPhone installieren

1. Die GitHub-Pages-Adresse in Safari öffnen.
2. **Teilen** wählen.
3. **Zum Home-Bildschirm** auswählen.

## Datenschutz

Dieser lokale Prototyp benötigt kein Benutzerkonto und sendet keine Vokabel- oder Lerndaten an einen Server. Vor einem echten Einsatz mit Schülerkonten, geräteübergreifender Rangliste oder Online-Klassenräumen ist ein eigenes Datenschutz- und Berechtigungskonzept erforderlich.
