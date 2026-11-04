# Android template replacement (experimental)

The bundled `template.apk` is now the user-supplied third-party working theme APK. The browser keeps its manifest, dex, and compiled resource table and replaces matching PNG resources, then signs the result. This avoids the earlier missing app components.

**Limitations:** The APK retains the reference theme package ID, label and XML/color resources. Selecting different types will overwrite the same installed theme rather than install side-by-side. Colors selected in the UI do not alter Android resource colors. This has NOT been tested on a real Android phone, and is not a finished independently built theme template. The reference APK may have redistribution restrictions; do not publish it publicly without permission.

To produce a proper distributable project, build a new theme from an appropriately licensed Android source template and compile resources with Android Gradle Plugin.
