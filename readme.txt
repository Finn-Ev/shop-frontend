<h1>WORK IN PROGRESS</h1>

<p>LEONEX Gulpfile v1.8.0</p>

<p>
Die neue <b>LEONEX Master Gulpfile</b> soll für alle neuen Projekte eingesetzt werden.<br>
In früheren Projekten hatte man immer das Problem, nicht zu wissen, in welchem Ordner z.B. die Gulpfile mit den Copy-Tasks zu finden ist. Außerdem war meist nicht klar, welche Commands zum Builden etc. die vielen verschiedenen Gulpfiles anbieten. Aus diesem Grund setzen wir nun auf die gleiche (konfigurierbare) Gulpfile für alle Projekte.<br>
Es gibt dann zu jedem Projekt nur noch eine "globale" Gulpfile (normalerweise im Root Ordner des Git-Repository), im Gegensatz zu (beispielsweise) einer Frontend-Gulpfile, einer Magento-Gulpfile und einer TYPO3-Gulpfile.<br>
Die Gulpfile stellt also alle Funktionalitäten für Frontend / TYPO3 / Magento bereit.
</p>

<p>
Das Projekt kann aus mehreren "Frontends" und "Targets" bestehen, für die es jeweils eine eigene Config-File gibt.
</p>

<p>
Meist wird es nur ein Frontend in einem Projekt geben. Möglich wäre es aber, bei z.B. einem Relaunch oder Design-Update das neue Frontend neben dem alten im Repo abzulegen und die Build-/Copy-Commands entsprechend zu konfigurieren.<br>
Frontend-Configs enthalten den Namen des CSS-Preprocessors (SASS oder LESS), den Namen des Ordners im Repo, in dem das Frontend liegt, sowie Vorschriften, was für Vendor-JS-Files erzeugt werden sollen (die benötigten JS Libraries werden dabei concatenated).<br>
Frontends werden mit dem Command <code>gulp build [--production] [--frontend NAME]</code> gebuildet, wobei standardmäßig ein Development-Build erzeugt wird, durch Angabe des Flags <code>--production</code> ein entsprechender Production-Build (Minification etc.). Sollen nicht alle Frontends eines Projektes gebuildet werden, sondern nur bestimmte, kann mit dem Paramater <code>--frontend NAME</code> ein Frontend-Identifier bzw. eine kommaseparierte Liste solcher angegeben werden.
</p>

<p>
Targets sind die CMS/Shop Instanzen des Projektes, d.h. meist TYPO3 und/oder Magento.<br>
Die entsprechenden Config-Files legen fest, welche Dateien vom gebuildeten Frontend zu der Anwendungsinstanz kopiert werden müssen, d.h. meist u.A. CSS- und JS-Files.<br>
Kopiervorgänge zu Targets werden mit dem Command <code>gulp copy [--production] [--target NAME]</code> durchgeführt, wobei standardmäßig ein Development-Build als Quelle der Dateien verwendet wird, durch Angabe des Flags <code>--production</code> ein entsprechender Production-Build (Minification etc.). Sollen nicht die Dateien aller Targets eines Projektes kopiert werden, sondern nur bestimmte, kann mit dem Paramater <code>--target NAME</code> ein Target-Identifier bzw. eine kommaseparierte Liste solcher angegeben werden. Die für den Kopiervorgang benötigten Frontends werden automatisch festgestellt und entsprechende Frontend-Builds zuvor ausgeführt, d.h. es ist nicht nötig, vor einem <code>gulp copy</code> erst <code>gulp build</code> auszuführen.
</p>



<h2>Ordnerstruktur</h2>
<pre>
repo/
    frontend/                       <- Frontend "default"
        bower_components/           <- Enthält die Frontend-Dependencies (JS Libraries etc.)
        build_dev/                  <- Hier landen Development Builds des Frontends (Ausnahme: dieser Ordner ist gitignored)
        build_prod/                 <- Hier landen Production Builds des Frontends (minified etc. / Ausnahme: dieser Ordner ist gitignored)
        src/                        <- Source Dateien des Frontends
    magento/                        <- Target "magento"
    typo3/                          <- Target "typo3"
    .gitignore                      <- .gitignore für node_modules etc.
    .jscsrc                         <- Nur für Frontend-Dev wichtig
    browserslist                    <- Nur für Frontend-Dev wichtig
    gulp-manpage-commands.txt       <- Hilfe zu den gulp commands (siehe Command "gulp help")
    gulp.frontend.default.json      <- Config-Datei für Frontend "default" (Ordner ./frontend/)
    gulp.frontend.[...].json
    gulp.target.magento.json        <- Config-Datei für Target "magento" (Ordner ./magento/)
    gulp.target.typo3.json          <- Config-Datei für Target "typo3" (Ordner ./typo3/)
    gulp.target.[...].json
    gulpfile.js                     <- Die LEONEX Master Gulpfile (diese Datei sollte nie modifiziert werden!)
    package.json                    <- Definiert die benötigten Node Packages für die Gulpfile
    readme.txt                      <- Diese Anleitung
    yarn.lock                       <- Die Lockfile, welche die exakten Versionsnummern der benötigen Node Packages enthält
</pre>

<p>
Alle diese Dateien sind im Git-Repository committed (bis auf die ausgewiesenen Ausnahmen) und sollten als Baseline dienen, wenn ein neues Projekt angelegt wird.
Die gulpfile.js und package.json Dateien enthalten eine Versionsnummer, diese müssen übereinstimmen, sonst kann die Gulpfile nicht ausgeführt werden. Also bei einem "Update" der LEONEX Master Gulpfile auch die package.json updaten (und dann <code>yarn install --force</code> ausführen).
</p>

<p>
Die per Bower installierten Packages werden in das Repo eingecheckt und müssen demnach nicht installiert werden, wenn das Projekt neu ausgecheckt wird.
</p>



<h2>Frontend Configs</h2>
<pre>
{
  "active": true,                   // falls false, wird dieses Frontend nicht beachtet
  "css_preprocessor": "sass",       // "sass" oder "less" werden supported
  "folders": {
    "basedir": "./frontend",        // einziger benötigter Wert, das Verzeichnis des Frontends
  },
  "vendor_js_concatenation": [      // Array von Vendor-JS-Concatenations
    {
      "output": "js/vendor.js",                     // Zieldatei im Build Ordner
      "files": [                                    // Array von Dateien im Source Ordner,
        "modernizr-custom.js",                      // sucht zuerst in /src/js/vendor/
        "modified/headroom.js",                     // und anschließend in /src/bower_components/
        "jquery/dist/jquery.js",                    // Die Reihenfolge der angegeben Dateien wird beibehalten.
        "fancyBox/dist/jquery.fancybox.js",
        "nouislider/distribute/nouislider.js"
      ]
    }
  ]
}
</pre>


<h2>Target Configs (mit TYPO3 Beispiel)</h2>
<pre>
{
  "active": true,               // falls false, wird dieses Target nicht beachtet
  "basedir": "./typo3",
  "theme": "extensionName",
  "clean": {
    "css": "typo3conf/ext/%THEME%/Resources/Public/Stylesheets/",
    "js": [
      "typo3conf/ext/%THEME%/Resources/Public/Javascript/",
      "typo3conf/ext/%THEME%/Resources/Public/JavascriptVendor/"
    ]
  },
  "copy": [                         // Array von Copy-Tasks
    {
      "frontend": "default",        // Frontend-Identifier, aus dem die Datei kopiert werden soll (Name aus dem Dateinamen der Frontend-Config-File)
      "profile": "css",             // Der "Dateityp" (nur wichtig, für Command "watch")
      "file": "css/main.css",       // Dateipfad im Frontend Build Ordner (einzelne Datei, die kopiert werden soll)
      "to": "typo3conf/ext/%THEME%/Resources/Public/Stylesheets/styles.css"     // Zielpfad des Kopiervorgangs, %THEME% wird mit oben konfiguriertem Identifier ersetzt (muss nicht genutzt werden)
    },
    {
      "frontend": "default",
      "profile": "js",
      "file": "js/all.js",
      "to": "typo3conf/ext/%THEME%/Resources/Public/Javascript/all.js"
    },
    {
      "frontend": "default",
      "profile": "jsVendor",
      "file": "js/vendor.js",
      "to": "typo3conf/ext/%THEME%/Resources/Public/Javascript/vendor.js"
    },
    {
      "frontend": "default",
      "profile": "images",
      "dir": "img/",                // Dateipfad im Frontend Build Ordner (kompletter Ordner, der kopiert werden soll)
      "to": "typo3conf/ext/%THEME%/Resources/Public/Images/"    // Zielpfad, Dateien im Ordner werden kopiert, nicht der Ordner selbst (so ist ein Umbenennen des Ordners möglich)
    },
    {
      "frontend": "default",
      "profile": "fonts",
      "dir": "fonts/",
      "to": "typo3conf/ext/%THEME%/Resources/Public/Fonts/"
    },
    {
      "frontend": "default",
      "profile": "css",
      "file": "css/print.css",
      "to": "typo3conf/ext/%THEME%/Resources/Public/Stylesheets/print.css"
    },
    {
      "frontend": "default",
      "profile": "css",
      "file": "css/ie.css",
      "to": "typo3conf/ext/%THEME%/Resources/Public/Stylesheets/styles_ie.css"
    }
  ]
}
</pre>


<h2>Yarn statt npm</h2>
<p>
Ab sofort setzen wir in unseren Projekten auf Yarn anstelle von npm als Package Dependency Management Tool. Dies ist ein modernerer "drop-in" Ersatz für npm und funktioniert praktisch identisch. Yarn verwendet weiterhin das gleiche Package Repository wie npm. Eigentlich ist alles gleich, nur der Client, mit dem die Packages installiert, ist besser.<br>
Hauptgrund bei der Entscheidung war, dass Yarn out-of-the-box eine sogannte Lockfile unterstützt. So können wir sicherstellen, dass ein Installieren der definierten erforderlichen Packages des Projektes auf allen Rechnern exakt die gleichen Package Versionen herunterläd (auch bei zeitlich versetzten Installationen). Dies war mit npm so nicht möglich. Außerdem ist Yarn auch schneller/robuster. Natürlich gibt es eine Windows-Version von Yarn, sogar mit GUI-Installer.
</p>

<p>
Hinweis:<br>
<code>npm install</code> heißt jetzt <code>yarn install</code><br>
<code>npm install pkg-name --save-dev</code> heißt jetzt <code>yarn add pkg-name --dev</code>
</p>

<h2>commands</h2>
WiP



<h2>Hilfe, ich bekomme einen "node-sass error"</h2>
<p>
Dieser Fehler tritt normalerweise nach einem Node.js Update auf.
</p>

Fehlermeldung (Beispiel):
<pre>
Error: Missing binding /...path.../node_modules/node-sass/vendor/darwin-x64-57/binding.node
Node Sass could not find a binding for your current environment: OS X 64-bit with Node.js 8.x

Found bindings for the following environments:
  - OS X 64-bit with Node.js 7.x

This usually happens because your environment has changed since running `npm install`.
Run `npm rebuild node-sass --force` to build the binding for your current environment.
</pre>
Der Fehler bedeutet, dass die Sass-Binaries nach dem Update nicht mehr passen, und Sass neu kompiliert werden muss.
Dies geschieht am Einfachsten durch ein Ausführen von: <code>yarn install --force</code>



<h2>Angebotene Gulp Commands</h2>
<p>
Diese Auflistung erhält man auch, wenn man "gulp help" ausführt.
</p>

<pre>
NAME
    gulp build

SYNOPSIS
    gulp build [--production] [--frontend NAME] [--no-images] [--no-linting]

DESCRIPTION
    Dieser Task builded ein oder mehrere Frontend(s).
    Frontends müssen eine Konfigurationsdatei besitzen, d.h. jeweils
    die Datei 'gulp.frontend.NAME.json' im Root-Ordner des Projektes.

OPTIONS
    --production
        JS/CSS minifizieren, keine Sourcemaps erzeugen, Bilder optimieren.
        Unterschiedliche Output-Ordner für Production und Development sind möglich,
        dies wird in den Frontend-Konfigurationsdateien definiert.

    --frontend NAME
        Nur das Frontend mit Bezeichnung NAME builden.
        Dabei kann NAME auch eine kommaseparierte Liste von Bezeichnern sein.
        Falls frontend nicht angegeben wird, werden alle verfügbaren Frontends gebuilded.

    --no-images
        Es werden keine Bilder optimiert (--production) bzw. kopiert (ohne --production).
        Insbesondere das optimieren kann sehr lange dauern und daher stören, falls
        man keine Änderungen an Bildern im Frontend vorgenommen hat.

    --no-linting
        Es wird kein Linting der JS-Sources durchgeführt (not recommended).




NAME
    gulp copy

SYNOPSIS
    gulp copy [--development / --no-production] [--target NAME] [--no-images] [--linting]

DESCRIPTION
    Dieser Task führt die in den Target-Konfigurationsdateien definierten Kopiervorgänge
    aus. Dazu werden zuerst alle benötigten Frontends gebuilded und anschließend die
    entsprechenden Dateien aus den Output-Ordnern der Frontends in die Target-Ordner
    kopiert.

OPTIONS
    --development
    --no-production
        JS/CSS nicht minifizieren, Sourcemaps erzeugen, Bilder nicht optimieren.

    --target NAME
        Nur die Kopiervorgänge für Target NAME ausführen ('gulp.target.NAME.json').
        Dabei kann NAME auch eine kommaseparierte Liste von Bezeichnern sein.
        Falls target nicht angegeben wird (oder 'all' als NAME übergeben wird),
        werden die Kopiervorgänge aller verfügbaren Targets durchgeführt.

    --no-images
        Dieser Parameter hat ausschließlich Einfluss auf die Build-Vorgänge der
        benötigten Frontends, und nicht auf die Kopiervorgänge aus den Target-
        Konfigurationen.
        Siehe Beschreibung der Eigenschaft '--no-images' bei 'gulp build'.

    --linting
        Der Copy-Task führt standardmäßig kein Linting aus, dies muss explizit
        per Paramater erzwungen werden.
        Dieser Parameter hat ausschließlich Einfluss auf die Build-Vorgänge der
        benötigten Frontends, und nicht auf die Kopiervorgänge aus den Target-
        Konfigurationen.
        Siehe Beschreibung der Eigenschaft '--no-linting' bei 'gulp build'.




NAME
    gulp watch

SYNOPSIS
    gulp watch [--production] [--frontend FNAME] [--target TNAME] [--no-images] [--no-linting]

DESCRIPTION
    Dieser Task überwacht Änderungen an Frontend-Dateien und führt dem Dateityp
    entsprechende Build-Tasks aus.
    Zusätzlich läuft während der Laufzeit dieses Tasks ein Webserver, der einzelne
    oder alle Frontends ausliefert (Standard-URL: http://localhost:3000, siehe Ausgabe).
    Seiten, die über den Webserver aufgerufen werden, unterstützen auto-refresh bei
    Änderungen von Source-Dateien (via BrowserSync).
    Durch die Angabe von Targets ist auch das anschließende automatisierte Kopieren
    von kompilierten Frontend-Dateien an entsprechend definierte Orte in Target-Ordnern
    möglich.

OPTIONS
    --production
        JS/CSS minifizieren, keine Sourcemaps erzeugen, Bilder optimieren.
        Beeinflusst ebenfalls die vom Webserver ausgelieferte Frontend-Version.

    --frontend FNAME
        Nur das angegebene Frontend überwachen (bzw. die angegebenen Frontends bei
        einer kommaseparierten Liste).
        Falls FNAME ein einzelner Frontend-Bezeichner ist, liefert der Webserver direkt
        und ausschließlich dieses Frontend aus.

    --target TNAME
        Kann nur verwendet werden, falls parameter '--frontend' nicht verwendet wird.
        Die Angabe eines Targets sorgt für einen dritten Schritt, der nach
        "1. Änderungen überwachen" und "2. Builden bei Änderungen" erfolgt:
        Das Ausführen der in den Target-Konfigurationsdateien definierten Kopiervorgänge.
        (So können z.B. Javascript-Änderungen im Frontend direkt im CMS/Shopsystem
        getestet werden.)
        Bei Verwendung dieses Parameters werden nur die Frontends überwacht, welche für
        Kopiervorgänge des Targets TNAME erforderlich sind.
        TNAME kann auch eine kommaseparierte Liste von Bezeichnern sein.

    --no-images
        Dieser Parameter hat ausschließlich Einfluss auf die Build-Vorgänge der
        benötigten Frontends, und nicht auf die Kopiervorgänge aus den Target-
        Konfigurationen.
        Siehe Beschreibung der Eigenschaft '--no-images' bei 'gulp build'.

    --no-linting
        Dieser Parameter hat ausschließlich Einfluss auf die Build-Vorgänge der
        benötigten Frontends, und nicht auf die Kopiervorgänge aus den Target-
        Konfigurationen.
        Siehe Beschreibung der Eigenschaft '--no-linting' bei 'gulp build'.
</pre>
